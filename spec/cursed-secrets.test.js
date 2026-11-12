const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = require('../lib/app');
const request = require('./request');
const TestHelper = require('./helper');
const corpus = require('./fixtures/cursed-secrets.json');

const helper = new TestHelper();
const enabled = process.env.FAKEAPI_CURSED === '1';
const strictSecretish = process.env.FAKEAPI_CURSED_STRICT === '1';

/**
 * Placeholder hook. A real redactor replaces this. With this identity
 * function the corpus is expected to fail, which is why the test stays
 * skipped unless FAKEAPI_CURSED=1.
 */
function placeholderHook(serialized) {
    return serialized;
}

function materialize(entry) {
    if (entry.id === 'password-is-literally-password') {
        return entry.key;
    }

    if (typeof entry.value === 'string') {
        return entry.value;
    }

    if (Array.isArray(entry.parts)) {
        return entry.parts.join('');
    }

    if (entry.id === 'basic-auth-header') {
        const user = ['fake', '_user'].join('');
        const pass = ['hunter', '2'].join('');
        return Buffer.from(user + ':' + pass).toString('base64');
    }

    if (entry.id === 'base64-wrapped-json') {
        const payload = JSON.stringify({
            client_secret: ['b64-wrapped', '-secret'].join(''),
        });
        return Buffer.from(payload).toString('base64');
    }

    if (entry.id === 'unicode-homoglyph-key') {
        return ['homo', 'glyph-value'].join('');
    }

    if (entry.id === 'response-body-secret') {
        return ['refresh', '-token-', 'canned'].join('');
    }

    if (entry.id === 'uuid') {
        return crypto.randomUUID();
    }

    if (entry.id === 'empty-secret') {
        return '';
    }

    if (entry.id === 'emoji-secret') {
        return String.fromCodePoint(0x1F511);
    }

    return '';
}

function needsRequestBody(entry) {
    return entry.id !== 'response-body-secret' && entry.location.endsWith('_body');
}

function requestBody(entry, value) {
    if (entry.location === 'json_body') {
        return JSON.stringify({ [entry.key]: value });
    }

    if (entry.location === 'xml_body') {
        if (entry.key === '<!--') {
            return value;
        }

        if (entry.key.startsWith('@')) {
            return '<root ' + entry.key.slice(1) + '="' + value + '"/>';
        }

        return '<' + entry.key + '>' + value + '</' + entry.key + '>';
    }

    if (entry.location === 'yaml_body') {
        if (entry.key === '#' || entry.key === '-') {
            return value;
        }

        return entry.key + ':\n' + value;
    }

    if (entry.location === 'form_body') {
        return entry.key + '=' + value;
    }

    return value;
}

function contentType(entry) {
    if (entry.location === 'json_body') {
        return 'application/json';
    }

    if (entry.location === 'xml_body') {
        return 'application/xml';
    }

    if (entry.location === 'yaml_body') {
        return 'text/yaml';
    }

    if (entry.location === 'form_body') {
        return 'application/x-www-form-urlencoded';
    }

    return 'text/plain';
}

describe('Cursed secrets corpus', () => {
    it('does not write assembled corpus values into JSON or XML logs', {
        skip: enabled ? false : 'set FAKEAPI_CURSED=1 to run; the placeholder hook is expected to fail',
        timeout: 60000,
    }, () => {
        const lines = [];
        const xmlFile = path.join(os.tmpdir(), 'fakeapi-cursed-' + process.pid + '.xml');
        fs.rmSync(xmlFile, { force: true });
        process.env.FAKEAPI_LOG_CAPTURE = 'all';
        process.env.FAKEAPI_LOG_XML_PATH = xmlFile;
        app.set('jsonLogWriter', (line) => {
            lines.push(line);
        });
        app.setRedactionHook(placeholderHook);

        let client = null;

        const prepared = corpus.entries.map((entry) => {
            return {
                entry,
                value: materialize(entry),
            };
        });

        return helper.buildServer().then((created) => {
            client = created;
            app.set('logging', true);
            return client.register('cursed');
        }).then(() => {
            return prepared.reduce((chain, item) => {
                return chain.then(() => sendEntry(client, item.entry, item.value));
            }, Promise.resolve());
        }).then(() => {
            const blob = lines.join('\n') + '\n' + fs.readFileSync(xmlFile, 'utf8');
            const missed = {
                definitely: [],
                likely: [],
                'secret-ish': [],
            };

            prepared.forEach((item) => {
                const entry = item.entry;
                const value = item.value;

                if (value === '') {
                    return;
                }

                if (blob.includes(value)) {
                    missed[entry.sensitivity].push(entry.id);
                }
            });

            const hard = missed.definitely.concat(missed.likely);

            if (missed['secret-ish'].length > 0) {
                console.log('secret-ish still present: ' + missed['secret-ish'].join(', '));
            }

            if (strictSecretish && missed['secret-ish'].length > 0) {
                hard.push.apply(hard, missed['secret-ish']);
            }

            expect(hard).toEqual([]);
        }).finally(() => {
            app.set('logging', false);
            app.set('jsonLogWriter', null);
            app.setRedactionHook((serialized) => serialized);
            delete process.env.FAKEAPI_LOG_CAPTURE;
            delete process.env.FAKEAPI_LOG_XML_PATH;
            fs.rmSync(xmlFile, { force: true });
            if (client) {
                helper.stopServer();
            }
        });
    });
});

function sendEntry(client, entry, value) {
    const endpoint = {
        method: needsRequestBody(entry) ? 'post' : 'get',
        path: '/c/' + entry.id,
        responses: [
            {
                status: 200,
                content: entry.id === 'response-body-secret'
                    ? JSON.stringify({ refresh_token: value })
                    : 'ok',
                content_type: entry.id === 'response-body-secret' ? 'application/json' : 'text/plain',
            },
        ],
    };

    return client.record(endpoint).then(() => {
        const headers = {};
        let url = client.server + endpoint.path;

        if (entry.location === 'header') {
            headers[entry.key] = value;
        } else {
            headers.authorization = 'Basic ' + Buffer.from(client.auth.user + ':' + client.auth.pass).toString('base64');
        }

        if (entry.location === 'query') {
            url += '?' + entry.key + '=' + value;
        }

        const options = {
            method: endpoint.method,
            url,
            headers,
        };

        if (needsRequestBody(entry)) {
            headers['content-type'] = contentType(entry);
            options.body = requestBody(entry, value);
        }

        return request(options).then(() => null, () => null);
    });
}
