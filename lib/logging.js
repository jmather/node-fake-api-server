const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { create } = require('xmlbuilder2');
const { parseRequestQuery } = require('./querystring');

const BODY_LIMIT = 64 * 1024;
const TRUNCATED_SUFFIX = '…[truncated]';

const FIELD_ORDER = [
    'timestamp',
    'level',
    'msg',
    'server',
    'request_id',
    'method',
    'path',
    'query',
    'status',
    'duration_ms',
    'action',
    'user',
];

let redactionHook = (serialized) => serialized;
let recordHook = (record) => record;

function setRedactionHook(fn) {
    if (typeof fn !== 'function') {
        throw new TypeError('Redaction hook must be a function (serialized, format) => string');
    }

    redactionHook = fn;
}

function setRecordHook(fn) {
    if (typeof fn !== 'function') {
        throw new TypeError('Record hook must be a function (record) => record');
    }

    recordHook = fn;
}

function prefixHook(serialized, format) {
    return '[' + format + ']' + serialized;
}

function stampHook(record) {
    const copy = Object.assign({}, record);
    copy.msg = String(record.msg) + ' [stamped]';
    return copy;
}

function loadHook(spec, kind) {
    if (!spec || spec === 'identity') {
        return null;
    }

    if (kind === 'string' && spec === 'prefix') {
        return prefixHook;
    }

    if (kind === 'object' && spec === 'stamp') {
        return stampHook;
    }

    const splitAt = spec.lastIndexOf(':');

    if (splitAt <= 0) {
        throw new Error('Unknown ' + kind + ' log hook: ' + spec);
    }

    const modulePath = spec.slice(0, splitAt);
    const exportName = spec.slice(splitAt + 1);
    const loaded = require(path.isAbsolute(modulePath) ? modulePath : path.resolve(modulePath));
    const fn = loaded[exportName];

    if (typeof fn !== 'function') {
        throw new Error('Log hook ' + spec + ' is not a function');
    }

    return fn;
}

const configuredStringHook = loadHook(process.env.FAKEAPI_LOG_HOOK, 'string');
const configuredRecordHook = loadHook(process.env.FAKEAPI_LOG_RECORD_HOOK, 'object');

if (configuredStringHook) {
    redactionHook = configuredStringHook;
}

if (configuredRecordHook) {
    recordHook = configuredRecordHook;
}

function captureMode() {
    const value = String(process.env.FAKEAPI_LOG_CAPTURE || 'none').toLowerCase();

    if (value === 'headers' || value === 'all') {
        return value;
    }

    return 'none';
}

function xmlLogPath() {
    const configured = process.env.FAKEAPI_LOG_XML_PATH;

    if (!configured) {
        return null;
    }

    return configured;
}

function decodeIgnore(buf) {
    let out = '';
    let index = 0;

    while (index < buf.length) {
        const byte = buf[index];
        let length;

        if (byte < 0x80) {
            length = 1;
        } else if ((byte & 0xe0) === 0xc0) {
            length = 2;
        } else if ((byte & 0xf0) === 0xe0) {
            length = 3;
        } else if ((byte & 0xf8) === 0xf0) {
            length = 4;
        } else {
            index++;
            continue;
        }

        if (index + length > buf.length) {
            break;
        }

        try {
            out += new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(index, index + length));
            index += length;
        } catch {
            index++;
        }
    }

    return out;
}

function capBody(input) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input == null ? '' : input));

    if (buf.length <= BODY_LIMIT) {
        return new TextDecoder('utf-8', { fatal: false }).decode(buf);
    }

    return decodeIgnore(buf.subarray(0, BODY_LIMIT)) + TRUNCATED_SUFFIX;
}

function headerObject(headers) {
    const out = {};

    Object.keys(headers || {}).forEach((key) => {
        const value = headers[key];
        const name = String(key).toLowerCase();

        if (Array.isArray(value)) {
            out[name] = value.map((item) => String(item));
            return;
        }

        out[name] = value == null ? '' : String(value);
    });

    return out;
}

function usernameFromBasic(req) {
    const header = req.headers.authorization;

    if (!header || !/^basic\s+/i.test(header)) {
        return null;
    }

    const encoded = header.replace(/^basic\s+/i, '');
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const splitAt = decoded.indexOf(':');

    if (splitAt === -1) {
        return decoded;
    }

    return decoded.slice(0, splitAt);
}

function pushChunk(chunks, chunk, encoding) {
    if (chunk == null || typeof chunk === 'function') {
        return;
    }

    if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        return;
    }

    if (typeof chunk === 'string') {
        const encodingName = typeof encoding === 'string' ? encoding : 'utf8';
        chunks.push(Buffer.from(chunk, encodingName));
    }
}

function captureResponseBody(res) {
    const chunks = [];
    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function write(chunk, encoding) {
        pushChunk(chunks, chunk, encoding);
        return originalWrite.apply(this, arguments);
    };

    res.end = function end(chunk, encoding) {
        pushChunk(chunks, chunk, encoding);
        return originalEnd.apply(this, arguments);
    };

    return () => Buffer.concat(chunks);
}

function buildRecord(req, res) {
    const started = res.locals.requested_at || Date.now();
    const record = {
        timestamp: new Date().toISOString(),
        server: 'node',
        request_id: req.id,
        method: req.method,
        path: req.path,
        query: req.fakeQueryLog || {},
        status: res.statusCode,
        duration_ms: Math.max(0, Date.now() - started),
        action: req.headers['x-fakeapi-action'] ? String(req.headers['x-fakeapi-action']) : null,
        user: usernameFromBasic(req),
    };

    const mode = res.locals.captureMode || 'none';

    if (mode === 'none') {
        return record;
    }

    const requestHeaders = headerObject(req.headers);
    const responseHeaders = headerObject(res.getHeaders());

    record.request = {
        headers: requestHeaders,
        content_type: requestHeaders['content-type'] || '',
    };
    record.response = {
        headers: responseHeaders,
        content_type: responseHeaders['content-type'] || '',
    };

    if (mode === 'all') {
        record.request.body = capBody(req.body || Buffer.alloc(0));
        const responseBody = res.locals.getCapturedBody ? res.locals.getCapturedBody() : Buffer.alloc(0);
        record.response.body = capBody(responseBody);
    }

    return record;
}

function canonicalize(parsed) {
    const record = {};

    FIELD_ORDER.forEach((key) => {
        record[key] = parsed[key];
    });

    if (Object.hasOwn(parsed, 'request')) {
        record.request = parsed.request;
    }

    if (Object.hasOwn(parsed, 'response')) {
        record.response = parsed.response;
    }

    return JSON.stringify(record);
}

function appendText(parent, name, value) {
    const element = parent.ele(name);

    if (value != null && value !== '') {
        element.txt(String(value));
    }

    return element.up();
}

function appendHeaderElements(parent, headers) {
    const container = parent.ele('headers');

    Object.keys(headers || {}).forEach((name) => {
        const value = headers[name];
        const values = Array.isArray(value) ? value : [value];

        values.forEach((item) => {
            container.ele('header').att('name', name).txt(item == null ? '' : String(item)).up();
        });
    });

    return container.up();
}

function appendQuery(parent, query) {
    const container = parent.ele('query');

    Object.keys(query || {}).forEach((name) => {
        const value = query[name];
        const values = Array.isArray(value) ? value : [value];

        values.forEach((item) => {
            container.ele('param').att('name', name).txt(item == null ? '' : String(item)).up();
        });
    });

    return container.up();
}

function appendCaptured(parent, name, captured) {
    if (!captured) {
        return parent;
    }

    const element = parent.ele(name);
    appendHeaderElements(element, captured.headers);
    appendText(element, 'content_type', captured.content_type);

    if (Object.hasOwn(captured, 'body')) {
        appendText(element, 'body', captured.body);
    }

    return element.up();
}

function serializeXml(record) {
    const root = create().ele('request-log');

    appendText(root, 'timestamp', record.timestamp);
    appendText(root, 'level', record.level);
    appendText(root, 'msg', record.msg);
    appendText(root, 'server', record.server);
    appendText(root, 'request_id', record.request_id);
    appendText(root, 'method', record.method);
    appendText(root, 'path', record.path);
    appendQuery(root, record.query);
    appendText(root, 'status', record.status);
    appendText(root, 'duration_ms', record.duration_ms);
    appendText(root, 'action', record.action);
    appendText(root, 'user', record.user);
    appendCaptured(root, 'request', record.request);
    appendCaptured(root, 'response', record.response);

    return root.end({ headless: true, prettyPrint: false }).replace(/\r/g, '&#13;').replace(/\n/g, '&#10;');
}

function writeJsonLine(app, text) {
    const writer = app.get('jsonLogWriter');

    if (typeof writer === 'function') {
        writer(text);
        return;
    }

    fs.writeSync(1, text);
}

function applyStringHook(serialized, format) {
    try {
        const value = redactionHook(serialized, format);

        if (typeof value !== 'string') {
            return null;
        }

        return value;
    } catch {
        return null;
    }
}

function applyRecordHook(record) {
    try {
        const value = recordHook(record);

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }

        return value;
    } catch {
        return null;
    }
}

function writeXmlLine(record) {
    const filePath = xmlLogPath();

    if (!filePath) {
        return;
    }

    const serialized = serializeXml(record) + '\n';
    const redacted = applyStringHook(serialized, 'xml');

    if (redacted == null) {
        return;
    }

    const line = redacted.endsWith('\n') ? redacted : redacted + '\n';

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, line);
}

function levelFor(statusCode) {
    if (statusCode >= 500) {
        return 'error';
    }

    if (statusCode >= 400) {
        return 'warn';
    }

    return 'info';
}

function emitRecord(app, req, res) {
    const record = buildRecord(req, res);
    record.level = levelFor(res.statusCode);
    record.msg = 'request completed';

    const hooked = applyRecordHook(record);

    if (!hooked) {
        return;
    }

    writeXmlLine(hooked);

    const redacted = applyStringHook(canonicalize(hooked) + '\n', 'json');

    if (redacted != null) {
        writeJsonLine(app, redacted.endsWith('\n') ? redacted : redacted + '\n');
    }
}

function install(app) {
    app.use((req, res, next) => {
        const id = crypto.randomUUID();
        req.id = id;
        res.setHeader('X-Request-Id', id);
        res.locals.requested_at = Date.now();
        res.locals.captureMode = captureMode();

        const parsedQuery = parseRequestQuery(req.originalUrl);
        req.fakeQueryLog = parsedQuery.log;
        req.fakeQueryMatch = parsedQuery.match;

        if (res.locals.captureMode === 'all') {
            res.locals.getCapturedBody = captureResponseBody(res);
        }

        res.on('finish', () => {
            if (app.get('logging') !== true) {
                return;
            }

            emitRecord(app, req, res);
        });

        next();
    });
}

function configuredHooks() {
    return {
        string: configuredStringHook || ((serialized) => serialized),
        object: configuredRecordHook || ((record) => record),
    };
}

module.exports = {
    install,
    setRedactionHook,
    setRecordHook,
    configuredHooks,
    capBody,
    canonicalize,
    serializeXml,
    BODY_LIMIT,
    TRUNCATED_SUFFIX,
};
