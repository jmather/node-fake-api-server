const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { create } = require('xmlbuilder2');

const app = require('../lib/app');
const request = require('./request');

const BASE_FIELDS = [
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

describe('Request logging', () => {
    let server = null;
    let base = null;
    const lines = [];

    beforeEach(() => {
        lines.length = 0;
        app.set('logging', true);
        app.set('jsonLogWriter', (line) => {
            lines.push(line);
        });
        app.setRedactionHook((serialized) => serialized);
        delete process.env.FAKEAPI_LOG_CAPTURE;
        delete process.env.FAKEAPI_LOG_XML_PATH;

        return new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, '127.0.0.1', () => {
                base = 'http://127.0.0.1:' + server.address().port;
                resolve();
            });
        });
    });

    afterEach(() => {
        app.set('logging', false);
        app.set('jsonLogWriter', null);
        app.setRedactionHook((serialized) => serialized);
        delete process.env.FAKEAPI_LOG_CAPTURE;
        delete process.env.FAKEAPI_LOG_XML_PATH;

        return new Promise((resolve) => {
            if (typeof server.closeAllConnections === 'function') {
                server.closeAllConnections();
            }
            server.close(() => resolve());
        });
    });

    function records() {
        return lines
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => JSON.parse(line));
    }

    function register(externalId) {
        return request({
            method: 'post',
            uri: base,
            headers: { 'X-FakeAPI-Action': 'register' },
            body: { external_id: externalId },
            json: true,
            resolveWithFullResponse: true,
        }).then((response) => response.body);
    }

    function record(user, endpoint) {
        return request({
            method: 'put',
            uri: base,
            headers: { 'X-FakeAPI-Action': 'record' },
            auth: { user: user.username, pass: user.password },
            body: endpoint,
            json: true,
        });
    }

    it('writes the shared JSON field names and omits capture by default', () => {
        const secret = ['raw', '-body', '-secret'].join('');

        return register('log').then((user) => {
            return request({
                method: 'post',
                url: base + '/not-recorded?a=1&a=2',
                auth: { user: user.username, pass: user.password },
                headers: {
                    'content-type': 'text/plain',
                    'X-Trace': 'Keep',
                },
                body: secret,
                resolveWithFullResponse: true,
            }).then(() => null, (error) => error);
        }).then((error) => {
            expect(error.statusCode).toBe(404);
            const logged = records().filter((row) => row.path === '/not-recorded');
            expect(logged).toHaveLength(1);

            const row = logged[0];
            expect(Object.keys(row)).toEqual(BASE_FIELDS);
            expect(row.msg).toBe('request completed');
            expect(row.server).toBe('node');
            expect(row.level).toBe('warn');
            expect(row.method).toBe('POST');
            expect(row.status).toBe(404);
            expect(row.query).toEqual({ a: ['1', '2'] });
            expect(row.action).toBe(null);
            expect(row.user).not.toBe(null);
            expect(typeof row.duration_ms).toBe('number');
            expect(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.timestamp)).toBe(true);
            expect(error.headers['x-request-id']).toBe(row.request_id);
            expect(Object.hasOwn(row, 'request')).toBe(false);
            expect(Object.hasOwn(row, 'response')).toBe(false);
            expect(JSON.stringify(row).includes(secret)).toBe(false);
            expect(JSON.stringify(row).includes('Keep')).toBe(false);
        });
    });

    it('logs info for success and error for 5xx', () => {
        return register('levels').then((user) => {
            return record(user, {
                method: 'get',
                path: '/ok',
                responses: [
                    {
                        status: 200,
                        content: 'ok',
                        content_type: 'text/plain',
                    },
                ],
            }).then(() => {
                return record(user, {
                    method: 'get',
                    path: '/boom',
                    responses: [
                        {
                            status: 500,
                            content: 'boom',
                            content_type: 'text/plain',
                        },
                    ],
                });
            }).then(() => user);
        }).then((user) => {
            const auth = { user: user.username, pass: user.password };
            return request({
                url: base + '/ok',
                auth,
                resolveWithFullResponse: true,
            }).then(() => {
                return request({
                    url: base + '/boom',
                    auth,
                }).then(() => null, () => null);
            });
        }).then(() => {
            const ok = records().filter((row) => row.path === '/ok')[0];
            const boom = records().filter((row) => row.path === '/boom')[0];
            expect(ok.level).toBe('info');
            expect(boom.level).toBe('error');
            expect(boom.msg).toBe('request completed');
            expect(Object.hasOwn(boom, 'err')).toBe(false);
        });
    });

    it('keeps the username and drops the password when capture is off', () => {
        return register('who').then((user) => {
            return request({
                url: base + '/who',
                auth: { user: user.username, pass: user.password },
            }).then(() => null, () => null).then(() => user);
        }).then((user) => {
            const row = records().filter((item) => item.path === '/who').pop();
            expect(row.user).toBe(user.username);
            expect(JSON.stringify(row).includes(user.password)).toBe(false);
        });
    });

    it('logs headers without bodies when capture is headers', () => {
        process.env.FAKEAPI_LOG_CAPTURE = 'headers';
        const secret = ['header', '-mode', '-body'].join('');

        return request({
            method: 'post',
            url: base + '/headers-only',
            headers: {
                'content-type': 'text/plain',
                'X-Custom-Header': 'Visible',
            },
            body: secret,
        }).then(() => null, () => null).then(() => {
            const row = records().filter((item) => item.path === '/headers-only').pop();
            expect(Object.keys(row)).toEqual(BASE_FIELDS.concat(['request', 'response']));
            expect(row.request.headers['x-custom-header']).toBe('Visible');
            expect(row.request.content_type).toBe('text/plain');
            expect(Object.hasOwn(row.request, 'body')).toBe(false);
            expect(Object.hasOwn(row.response, 'body')).toBe(false);
            expect(JSON.stringify(row).includes(secret)).toBe(false);
        });
    });

    it('logs raw bodies when capture is all and truncates past 64 KiB', () => {
        process.env.FAKEAPI_LOG_CAPTURE = 'all';
        const xml = '<note>a<b>&c</note>';
        const huge = 'z'.repeat((64 * 1024) + 50);

        return request({
            method: 'post',
            url: base + '/raw',
            headers: { 'content-type': 'application/xml' },
            body: xml,
        }).then(() => null, () => null).then(() => {
            return request({
                method: 'post',
                url: base + '/huge',
                headers: { 'content-type': 'text/plain' },
                body: huge,
            });
        }).then(() => null, () => null).then(() => {
            const raw = records().filter((item) => item.path === '/raw').pop();
            expect(raw.request.body).toBe(xml);
            expect(typeof raw.request.body).toBe('string');
            expect(raw.request.content_type).toBe('application/xml');
            expect(raw.response.body.length > 0).toBe(true);

            const suffix = '…[truncated]';
            const big = records().filter((item) => item.path === '/huge').pop();
            expect(big.request.body.endsWith(suffix)).toBe(true);
            expect(Buffer.byteLength(big.request.body.slice(0, -suffix.length))).toBe(64 * 1024);
            expect(Buffer.byteLength(big.request.body) > 64 * 1024).toBe(true);
        });
    });

    it('writes well-formed XML only when the path is set, and applies the hook to both sinks', () => {
        const xmlFile = path.join(os.tmpdir(), 'fakeapi-log-' + process.pid + '.xml');
        fs.rmSync(xmlFile, { force: true });
        process.env.FAKEAPI_LOG_CAPTURE = 'all';
        process.env.FAKEAPI_LOG_XML_PATH = xmlFile;

        const seen = [];
        app.setRedactionHook((serialized, format) => {
            seen.push(format);
            if (format === 'json') {
                return serialized.replace('"msg":"request completed"', '"msg":"hooked"');
            }
            return serialized.replace('<msg>request completed</msg>', '<msg>hooked</msg>');
        });

        return request({
            method: 'post',
            url: base + '/hooked?q=1',
            headers: { 'content-type': 'text/plain' },
            body: 'a<b>&c',
        }).then(() => null, () => null).then(() => {
            const row = records().filter((item) => item.path === '/hooked').pop();
            expect(row.msg).toBe('hooked');
            expect(seen).toEqual(['json', 'xml']);

            const xml = fs.readFileSync(xmlFile, 'utf8').trim();
            const parsed = create(xml);
            expect(parsed.toObject()['request-log'].msg).toBe('hooked');
            expect(xml.startsWith('<request-log>')).toBe(true);
            expect(xml.includes('<body>a&lt;b&gt;&amp;c</body>')).toBe(true);
            expect(xml.includes('<param name="q">1</param>')).toBe(true);
            expect(xml.includes('</request-log>')).toBe(true);
            fs.rmSync(xmlFile, { force: true });
        });
    });

    it('does not create an XML file when the sink is off', () => {
        const xmlFile = path.join(os.tmpdir(), 'fakeapi-log-off-' + process.pid + '.xml');
        fs.rmSync(xmlFile, { force: true });

        return request({ url: base + '/no-xml' }).then(() => null, () => null).then(() => {
            expect(fs.existsSync(xmlFile)).toBe(false);
            expect(records().some((row) => row.path === '/no-xml')).toBe(true);
        });
    });
});
