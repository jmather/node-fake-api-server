#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { create } = require('xmlbuilder2');

const ROOT = path.join(__dirname, '..');
const CONFORMANCE = path.join(ROOT, 'conformance');
const SERVER = 'node';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function fail(message) {
    const error = new Error(message);
    error.failure = true;
    return error;
}

function verifySuite() {
    const version = fs.readFileSync(path.join(CONFORMANCE, 'VERSION'));

    if (!version.equals(Buffer.from('1\n'))) {
        throw fail('VERSION must be the bytes 1\\n');
    }

    const listed = new Map();
    const sums = fs.readFileSync(path.join(CONFORMANCE, 'SHA256SUMS'), 'utf8');

    sums.split('\n').forEach((line) => {
        if (line === '') {
            return;
        }

        const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);

        if (!match) {
            throw fail('SHA256SUMS line is not sha256sum format: ' + line);
        }

        listed.set(match[2], match[1]);
    });

    const found = [];

    function walk(directory, prefix) {
        fs.readdirSync(directory).sort().forEach((name) => {
            if (name === 'SHA256SUMS' && prefix === '') {
                return;
            }

            const relative = prefix ? prefix + '/' + name : name;
            const full = path.join(directory, name);
            const stat = fs.statSync(full);

            if (stat.isDirectory()) {
                walk(full, relative);
                return;
            }

            found.push(relative);
        });
    }

    walk(CONFORMANCE, '');

    const foundSet = new Set(found);

    listed.forEach((digest, relative) => {
        if (!foundSet.has(relative)) {
            throw fail('SHA256SUMS lists missing file ' + relative);
        }

        const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(CONFORMANCE, relative))).digest('hex');

        if (actual !== digest) {
            throw fail('checksum mismatch for ' + relative);
        }
    });

    found.forEach((relative) => {
        if (!listed.has(relative)) {
            throw fail('file is not listed in SHA256SUMS: ' + relative);
        }
    });
}

function interpolate(value, captures) {
    if (typeof value !== 'string') {
        return value;
    }

    return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (whole, name) => {
        if (name === 'server') {
            return SERVER;
        }

        if (!Object.hasOwn(captures, name)) {
            throw fail('unknown capture {{' + name + '}}');
        }

        return String(captures[name]);
    });
}

function encodeForm(value) {
    return encodeURIComponent(String(value)).replace(/%20/g, '+');
}

function encodeQuery(query, captures) {
    const parts = [];

    Object.keys(query).forEach((key) => {
        const value = query[key];
        const values = Array.isArray(value) ? value : [value];

        values.forEach((item) => {
            parts.push(encodeForm(key) + '=' + encodeForm(interpolate(item, captures)));
        });
    });

    return parts.join('&');
}

function encodeBody(body, captures) {
    if (body == null) {
        return null;
    }

    if (typeof body === 'string') {
        return Buffer.from(interpolate(body, captures));
    }

    if (body.base64) {
        return Buffer.from(body.base64, 'base64');
    }

    if (body.repeat) {
        return Buffer.from(String(body.repeat).repeat(body.count));
    }

    throw fail('unsupported body spec');
}

function fullMatch(pattern, text) {
    return new RegExp('^(?:' + pattern + ')$').test(text);
}

function headerOf(headers, name) {
    return headers[String(name).toLowerCase()];
}

function matchJson(actual, expected, captures, responseHeaders) {
    if (expected && typeof expected === 'object' && !Array.isArray(expected) && typeof expected.match === 'string') {
        return matchSpecial(actual, expected, captures, responseHeaders);
    }

    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || actual.length !== expected.length) {
            return 'array length mismatch';
        }

        for (let index = 0; index < expected.length; index++) {
            const mismatch = matchJson(actual[index], expected[index], captures, responseHeaders);

            if (mismatch) {
                return 'item ' + index + ': ' + mismatch;
            }
        }

        return null;
    }

    if (expected && typeof expected === 'object') {
        if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
            return 'expected object';
        }

        const expectedKeys = Object.keys(expected);
        const actualKeys = Object.keys(actual);

        for (const key of expectedKeys) {
            if (!Object.hasOwn(actual, key)) {
                return 'missing key ' + key;
            }
        }

        for (const key of actualKeys) {
            if (!Object.hasOwn(expected, key)) {
                return 'unexpected key ' + key;
            }
        }

        for (const key of expectedKeys) {
            const mismatch = matchJson(actual[key], expected[key], captures, responseHeaders);

            if (mismatch) {
                return key + ': ' + mismatch;
            }
        }

        return null;
    }

    if (typeof expected === 'string') {
        expected = interpolate(expected, captures);
    }

    if (actual !== expected) {
        return 'expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual);
    }

    return null;
}

function matchSpecial(actual, expected, captures, responseHeaders) {
    let text = actual;

    if (expected.match === 'uuid') {
        if (typeof actual !== 'string' || !UUID.test(actual)) {
            return 'expected uuid but got ' + JSON.stringify(actual);
        }
    } else if (expected.match === 'non_empty') {
        if (typeof actual !== 'string' || actual.length < 1) {
            return 'expected non-empty string';
        }
    } else if (expected.match === 'timestamp') {
        if (typeof actual !== 'string' || !TIMESTAMP.test(actual)) {
            return 'expected timestamp but got ' + JSON.stringify(actual);
        }
    } else if (expected.match === 'number') {
        if (typeof actual !== 'number' || typeof actual === 'boolean') {
            return 'expected number but got ' + JSON.stringify(actual);
        }

        if (expected.minimum != null && actual < expected.minimum) {
            return 'number ' + actual + ' is below ' + expected.minimum;
        }

        if (expected.maximum != null && actual > expected.maximum) {
            return 'number ' + actual + ' is above ' + expected.maximum;
        }

        text = String(actual);
    } else if (expected.match === 'basic_token') {
        const username = captures[expected.username];
        const password = captures[expected.password];
        const token = Buffer.from(String(username) + ':' + String(password), 'utf8').toString('base64');

        if (actual !== token) {
            return 'auth_token is not base64 of the captured credentials';
        }
    } else if (expected.match === 'var') {
        if (actual !== captures[expected.name]) {
            return 'expected captured ' + expected.name;
        }
    } else if (expected.match === 'regex') {
        if (typeof actual !== 'string' || !fullMatch(expected.pattern, actual)) {
            return 'regex did not fullmatch ' + JSON.stringify(actual);
        }
    } else if (expected.match === 'object') {
        if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
            return 'expected object';
        }

        const absent = expected.absent || [];

        for (const key of absent) {
            if (Object.hasOwn(actual, key)) {
                return 'key ' + key + ' should be absent';
            }
        }

        const keys = expected.keys || {};

        for (const key of Object.keys(keys)) {
            if (!Object.hasOwn(actual, key)) {
                return 'missing key ' + key;
            }

            const mismatch = matchJson(actual[key], keys[key], captures, responseHeaders);

            if (mismatch) {
                return key + ': ' + mismatch;
            }
        }

        text = null;
    } else {
        return 'unknown matcher ' + expected.match;
    }

    if (expected.equals_header) {
        const header = headerOf(responseHeaders, expected.equals_header);

        if (actual !== header) {
            return 'value does not equal header ' + expected.equals_header;
        }
    }

    if (expected.capture) {
        captures[expected.capture] = text == null ? actual : String(actual);
    }

    return null;
}

function checkHeaders(actualHeaders, checks, captures, requestUrl) {
    for (const check of checks || []) {
        const name = check.name.toLowerCase();
        const present = Object.hasOwn(actualHeaders, name);
        const value = present ? String(actualHeaders[name]) : '';

        if (check.match === 'absent') {
            if (present) {
                return 'header ' + check.name + ' should be absent';
            }

            continue;
        }

        if (!present) {
            return 'header ' + check.name + ' is missing';
        }

        if (check.match === 'present') {
            continue;
        }

        const expected = check.match === 'request_url' ? requestUrl : interpolate(check.value || '', captures);

        if (check.match === 'exact' || check.match === 'request_url') {
            if (value !== expected) {
                return 'header ' + check.name + ' expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(value);
            }
        } else if (check.match === 'prefix') {
            if (!value.startsWith(expected)) {
                return 'header ' + check.name + ' does not start with ' + JSON.stringify(expected);
            }
        } else if (check.match === 'contains') {
            if (!value.includes(expected)) {
                return 'header ' + check.name + ' does not contain ' + JSON.stringify(expected);
            }
        } else if (check.match === 'uuid') {
            if (!UUID.test(value)) {
                return 'header ' + check.name + ' is not a uuid';
            }
        } else if (check.match === 'regex') {
            if (!fullMatch(check.value, value)) {
                return 'header ' + check.name + ' failed regex';
            }
        } else {
            return 'unknown header match ' + check.match;
        }
    }

    return null;
}

function checkBody(body, expect, captures) {
    if (!expect) {
        return null;
    }

    if (expect.match === 'empty') {
        return body.length === 0 ? null : 'expected an empty body';
    }

    if (expect.match === 'file') {
        const expected = fs.readFileSync(path.join(CONFORMANCE, expect.path));
        return body.equals(expected) ? null : 'body bytes differ from ' + expect.path;
    }

    const text = body.toString('utf8');

    if (expect.match === 'exact') {
        const expected = interpolate(expect.value, captures);
        return text === expected ? null : 'body expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(text);
    }

    if (expect.match === 'regex') {
        return fullMatch(expect.pattern, text) ? null : 'body failed regex';
    }

    if (expect.match === 'json') {
        let parsed;

        try {
            parsed = JSON.parse(text);
        } catch {
            return 'body is not JSON';
        }

        return matchJson(parsed, expect.value, captures, {});
    }

    return 'unknown body match ' + expect.match;
}

function elementChildren(node) {
    const children = [];

    for (const child of node.childNodes || []) {
        if (child.nodeType === 1) {
            children.push(child);
        }
    }

    return children;
}

function elementText(node) {
    let text = '';

    for (const child of node.childNodes || []) {
        if (child.nodeType === 3) {
            text += child.nodeValue;
        }
    }

    return text;
}

function xmlValue(xml, spec) {
    const root = create(xml).root().node;
    let nodes = [root];

    spec.split('/').forEach((segment) => {
        const match = /^([^@#]+)(?:@([^=]+)=([^#]*))?(?:#(\d+))?$/.exec(segment);

        if (!match) {
            nodes = [];
            return;
        }

        const name = match[1];
        const attr = match[2];
        const attrValue = match[3];
        const index = match[4] == null ? null : Number(match[4]);
        const next = [];

        nodes.forEach((node) => {
            elementChildren(node).forEach((child) => {
                if (child.nodeName !== name) {
                    return;
                }

                if (attr && child.getAttribute(attr) !== attrValue) {
                    return;
                }

                next.push(child);
            });
        });

        nodes = index == null ? next : (next[index] ? [next[index]] : []);
    });

    if (nodes.length === 0) {
        return null;
    }

    return elementText(nodes[0]);
}

function isRecordLine(line, prefix) {
    const text = line.replace(/\n$/, '');

    if (prefix) {
        if (text.startsWith('{')) {
            throw fail('JSON log line was not prefixed with [json]');
        }

        return text.startsWith('[json]');
    }

    return text.startsWith('{');
}

function waitForPort(port) {
    const started = Date.now();

    return new Promise((resolve, reject) => {
        const attempt = () => {
            const socket = net.connect({ host: '127.0.0.1', port }, () => {
                socket.end();
                resolve();
            });

            socket.on('error', () => {
                socket.destroy();

                if (Date.now() - started > 30000) {
                    reject(fail('server did not accept TCP within 30 seconds'));
                    return;
                }

                setTimeout(attempt, 50);
            });
        };

        attempt();
    });
}

function startServer(scenario, xmlPath) {
    const env = {};

    Object.keys(process.env).forEach((key) => {
        if (!key.startsWith('FAKEAPI_')) {
            env[key] = process.env[key];
        }
    });

    Object.assign(env, scenario.env || {});

    if (scenario.xml_log) {
        env.FAKEAPI_LOG_XML_PATH = xmlPath;
    }

    const hooks = scenario.hooks || {};

    if ((hooks.string || 'identity') === 'prefix') {
        env.FAKEAPI_LOG_HOOK = 'prefix';
    }

    if ((hooks.object || 'identity') === 'stamp') {
        env.FAKEAPI_LOG_RECORD_HOOK = 'stamp';
    }

    env.PORT = '0';

    const child = spawn(process.execPath, [path.join(ROOT, 'bin/www')], {
        cwd: ROOT,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let captured = '';
    let stderr = '';
    const records = [];
    const waiters = [];
    const prefix = (hooks.string || 'identity') === 'prefix';

    const deliver = () => {
        while (records.length > 0 && waiters.length > 0) {
            waiters.shift()(records.shift());
        }
    };

    child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        captured += text;
        stdout += text;
        let newline = stdout.indexOf('\n');

        while (newline !== -1) {
            const line = stdout.slice(0, newline + 1);
            stdout = stdout.slice(newline + 1);

            try {
                if (isRecordLine(line, prefix)) {
                    records.push(line);
                    deliver();
                }
            } catch (err) {
                records.push(err);
                deliver();
            }

            newline = stdout.indexOf('\n');
        }
    });

    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });

    const ready = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(fail('server did not listen within 30 seconds\n' + stderr));
        }, 30000);

        const watch = () => {
            const match = (captured + stderr).match(/Listening at http:\/\/127\.0\.0\.1:(\d+)/);

            if (!match) {
                return;
            }

            clearTimeout(timer);
            const port = Number(match[1]);
            waitForPort(port).then(() => resolve({ port, child }), reject);
        };

        child.stdout.on('data', watch);
        child.stderr.on('data', watch);
        child.on('exit', (code) => {
            clearTimeout(timer);
            reject(fail('server exited early (' + code + ')\n' + stderr));
        });
    });

    return {
        ready,
        nextLog() {
            if (records.length > 0) {
                const line = records.shift();

                if (line instanceof Error) {
                    return Promise.reject(line);
                }

                return Promise.resolve(line);
            }

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(fail('timed out waiting for a JSON log line'));
                }, 5000);

                waiters.push((line) => {
                    clearTimeout(timer);

                    if (line instanceof Error) {
                        reject(line);
                        return;
                    }

                    resolve(line);
                });
            });
        },
        stop() {
            child.kill('SIGTERM');
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    child.kill('SIGKILL');
                }, 1000);

                child.on('exit', () => {
                    clearTimeout(timer);
                    resolve();
                });
            });
        },
    };
}

function httpCall(url, method, headers, body) {
    const started = process.hrtime.bigint();

    return new Promise((resolve, reject) => {
        const request = http.request(url, { method, headers }, (response) => {
            const chunks = [];

            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
                resolve({
                    status: response.statusCode,
                    headers: response.headers,
                    body: Buffer.concat(chunks),
                    elapsed,
                });
            });
        });

        request.on('error', reject);

        if (body) {
            request.end(body);
            return;
        }

        request.end();
    });
}

async function runStep(step, base, captures, logs, xmlPath, httpIndex, prefix) {
    if (step.kind === 'sleep' || (step.ms != null && !step.request)) {
        await new Promise((resolve) => setTimeout(resolve, step.ms));
        return;
    }

    const spec = step.request;
    const method = spec.method || 'GET';
    const requestPath = interpolate(spec.path, captures);
    let query = '';

    if (spec.query && spec.query_raw) {
        throw fail('query and query_raw are mutually exclusive');
    }

    if (spec.query) {
        query = encodeQuery(spec.query, captures);
    } else if (spec.query_raw) {
        query = interpolate(spec.query_raw, captures);
    }

    const relative = requestPath + (query ? '?' + query : '');
    const url = base + relative;
    const headers = {};

    Object.keys(spec.headers || {}).forEach((name) => {
        headers[name] = interpolate(spec.headers[name], captures);
    });

    const body = encodeBody(spec.body, captures);

    if (body) {
        headers['Content-Length'] = String(body.length);
    }

    const response = await httpCall(url, method, headers, body);
    const logLine = await logs.nextLog();
    const expect = step.expect || {};

    if (expect.status != null && response.status !== expect.status) {
        throw fail('status ' + response.status + ' != ' + expect.status + ' body ' + response.body.toString('utf8'));
    }

    if (expect.elapsed_ms_gte != null && response.elapsed < expect.elapsed_ms_gte) {
        throw fail('elapsed ' + response.elapsed + 'ms is below ' + expect.elapsed_ms_gte);
    }

    const headerMismatch = checkHeaders(response.headers, expect.headers, captures, url);

    if (headerMismatch) {
        throw fail(headerMismatch);
    }

    const bodyMismatch = checkBody(response.body, expect.body, captures);

    if (bodyMismatch) {
        throw fail(bodyMismatch);
    }

    if (step.log) {
        assertLog(step.log, logLine, captures, response.headers, xmlPath, httpIndex, prefix);
    }
}

function assertLog(assertion, rawLine, captures, responseHeaders, xmlPath, httpIndex, prefix) {
    if (assertion.raw_prefix && !rawLine.startsWith(assertion.raw_prefix)) {
        throw fail('log line does not start with ' + assertion.raw_prefix);
    }

    (assertion.raw_excludes || []).forEach((item) => {
        const excluded = interpolate(item, captures);

        if (excluded && rawLine.includes(excluded)) {
            throw fail('log line contains excluded text');
        }
    });

    let jsonText = rawLine.replace(/\n$/, '');

    if (prefix) {
        if (!jsonText.startsWith('[json]')) {
            throw fail('missing [json] prefix');
        }

        jsonText = jsonText.slice('[json]'.length);
    }

    let parsed;

    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw fail('log line is not JSON');
    }

    if (assertion.json) {
        const mismatch = matchJson(parsed, assertion.json.value, captures, responseHeaders);

        if (mismatch) {
            throw fail('log json: ' + mismatch);
        }
    }

    if (assertion.xml) {
        const lines = fs.readFileSync(xmlPath, 'utf8').split('\n').filter((line) => line.length > 0);
        let xml = lines[httpIndex];

        if (xml == null) {
            throw fail('missing XML record ' + httpIndex);
        }

        if (prefix) {
            if (!xml.startsWith('[xml]')) {
                throw fail('XML record is missing [xml]');
            }

            xml = xml.slice('[xml]'.length);
        }

        const expected = assertion.xml.text || {};

        Object.keys(expected).forEach((spec) => {
            const actual = xmlValue(xml, spec);
            const wanted = interpolate(expected[spec], captures);

            if (actual !== wanted) {
                throw fail('xml ' + spec + ' expected ' + JSON.stringify(wanted) + ' but got ' + JSON.stringify(actual));
            }
        });
    }
}

async function runScenario(scenario) {
    const xmlPath = path.join(require('os').tmpdir(), 'fakeapi-conformance-' + process.pid + '-' + scenario.id + '.xml');
    fs.rmSync(xmlPath, { force: true });
    const server = startServer(scenario, xmlPath);
    const prefix = ((scenario.hooks || {}).string || 'identity') === 'prefix';

    try {
        const started = await server.ready;
        const base = 'http://127.0.0.1:' + started.port;
        const captures = {};
        let httpIndex = 0;

        for (const step of scenario.steps) {
            const isHttp = step.request != null;

            try {
                await runStep(step, base, captures, server, xmlPath, httpIndex, prefix);
            } catch (err) {
                err.stepId = step.id || step.kind || 'sleep';
                throw err;
            }

            if (isHttp) {
                httpIndex++;
            }
        }
    } finally {
        await server.stop();
        fs.rmSync(xmlPath, { force: true });
    }
}

async function main() {
    try {
        verifySuite();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    const files = fs.readdirSync(path.join(CONFORMANCE, 'fixtures')).filter((name) => name.endsWith('.json')).sort();
    let failed = 0;

    for (const file of files) {
        const scenario = JSON.parse(fs.readFileSync(path.join(CONFORMANCE, 'fixtures', file), 'utf8'));

        try {
            await runScenario(scenario);
            console.log('ok ' + scenario.id);
        } catch (err) {
            failed++;
            console.error('FAIL ' + scenario.id + (err.stepId ? ' step ' + err.stepId : ''));
            console.error(err.message);
        }
    }

    process.exit(failed === 0 ? 0 : 1);
}

main();
