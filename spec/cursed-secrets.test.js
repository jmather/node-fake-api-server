const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { create } = require('xmlbuilder2');

const app = require('../lib/app');
const logging = require('../lib/logging');
const request = require('./request');
const TestHelper = require('./helper');
const corpus = require('./fixtures/cursed-secrets.json');

const helper = new TestHelper();
const enabled = process.env.FAKEAPI_CURSED === '1';
const strictSecretish = process.env.FAKEAPI_CURSED_STRICT === '1';

function identityString(serialized) {
    return serialized;
}

function identityRecord(record) {
    return record;
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

function collectJson(value, found) {
    if (typeof value === 'string') {
        found.push(value);
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => collectJson(item, found));
        return;
    }

    if (value && typeof value === 'object') {
        Object.keys(value).forEach((key) => {
            found.push(key);
            collectJson(value[key], found);
        });
    }
}

function collectXml(xml, found) {
    const text = xml.startsWith('[xml]') ? xml.slice('[xml]'.length) : xml;
    const root = create(text).root().node;

    const walk = (node) => {
        if (node.attributes) {
            for (const attr of node.attributes) {
                found.push(attr.name);
                found.push(attr.value);
            }
        }

        for (const child of node.childNodes || []) {
            if (child.nodeType === 3 && child.nodeValue) {
                found.push(child.nodeValue);
            }

            if (child.nodeType === 1) {
                walk(child);
            }
        }
    };

    walk(root);
}

function decodedValues(lines, xmlFile) {
    const found = [];

    lines.forEach((line) => {
        const text = line.trim().startsWith('[json]') ? line.trim().slice('[json]'.length) : line;
        collectJson(JSON.parse(text), found);
    });

    if (fs.existsSync(xmlFile)) {
        fs.readFileSync(xmlFile, 'utf8').split('\n').filter((line) => line.length > 0).forEach((line) => {
            collectXml(line, found);
        });
    }

    return found;
}

describe('Cursed secrets corpus', () => {
    it('searches decoded log values in string, object, and both hook modes', {
        skip: enabled ? false : 'set FAKEAPI_CURSED=1 to run; identity hooks are expected to fail',
        timeout: 60000,
    }, () => {
        const installed = logging.configuredHooks();
        const prepared = corpus.entries.map((entry) => {
            return {
                entry,
                value: materialize(entry),
            };
        });
        const modes = [
            { name: 'string', string: installed.string, object: identityRecord },
            { name: 'object', string: identityString, object: installed.object },
            { name: 'both', string: installed.string, object: installed.object },
        ];
        const missed = {};

        return modes.reduce((chain, mode) => {
            return chain.then(() => runMode(mode, prepared).then((modeMissed) => {
                missed[mode.name] = modeMissed;
                console.log(mode.name + ' definitely: ' + modeMissed.definitely.join(', '));
                console.log(mode.name + ' likely: ' + modeMissed.likely.join(', '));
                console.log(mode.name + ' secret-ish: ' + modeMissed['secret-ish'].join(', '));
            }));
        }, Promise.resolve()).then(() => {
            const hard = [];

            modes.forEach((mode) => {
                missed[mode.name].definitely.forEach((id) => hard.push(mode.name + ':definitely:' + id));
                missed[mode.name].likely.forEach((id) => hard.push(mode.name + ':likely:' + id));

                if (strictSecretish) {
                    missed[mode.name]['secret-ish'].forEach((id) => hard.push(mode.name + ':secret-ish:' + id));
                }
            });

            expect(hard).toEqual([]);
        });
    });
});

function runMode(mode, prepared) {
    const lines = [];
    const xmlFile = path.join(os.tmpdir(), 'fakeapi-cursed-' + process.pid + '-' + mode.name + '.xml');
    fs.rmSync(xmlFile, { force: true });
    process.env.FAKEAPI_LOG_CAPTURE = 'all';
    process.env.FAKEAPI_LOG_XML_PATH = xmlFile;
    app.set('jsonLogWriter', (line) => {
        lines.push(line);
    });
    app.setRedactionHook(mode.string);
    app.setRecordHook(mode.object);

    let client = null;

    return helper.buildServer().then((created) => {
        client = created;
        app.set('logging', true);
        return client.register('cursed-' + mode.name);
    }).then(() => {
        return prepared.reduce((chain, item) => {
            return chain.then(() => sendEntry(client, item.entry, item.value, mode.name));
        }, Promise.resolve());
    }).then(() => {
        const found = decodedValues(lines, xmlFile);
        const modeMissed = {
            definitely: [],
            likely: [],
            'secret-ish': [],
        };

        prepared.forEach((item) => {
            if (item.value === '') {
                return;
            }

            if (found.some((text) => String(text).includes(item.value))) {
                modeMissed[item.entry.sensitivity].push(item.entry.id);
            }
        });

        return modeMissed;
    }).finally(() => {
        app.set('logging', false);
        app.set('jsonLogWriter', null);
        app.setRedactionHook(identityString);
        app.setRecordHook(identityRecord);
        delete process.env.FAKEAPI_LOG_CAPTURE;
        delete process.env.FAKEAPI_LOG_XML_PATH;
        fs.rmSync(xmlFile, { force: true });
        if (client) {
            helper.stopServer();
        }
    });
}

function sendEntry(client, entry, value, mode) {
    const endpoint = {
        method: needsRequestBody(entry) ? 'post' : 'get',
        path: '/c/' + mode + '/' + entry.id,
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
