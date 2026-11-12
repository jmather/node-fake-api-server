const { spawn } = require('child_process');
const path = require('path');

const request = require('./request');
const TestHelper = require('./helper');

describe('Smoke', () => {
    const helper = new TestHelper();

    let client = null;

    beforeEach(() => {
        return helper.buildServer().then((c) => {
            client = c;
        });
    });

    afterEach(() => {
        helper.stopServer();
        client = null;
    });

    it('registers, records, and serves a fake endpoint', () => {
        const endpoint = {
            method: 'get',
            path: '/smoke',
            responses: [
                {
                    status: 200,
                    content: 'smoke ok',
                    content_type: 'text/plain',
                },
            ],
        };

        return client.register('smoke').then((user) => {
            expect(typeof user.username).toBe('string');
            expect(typeof user.password).toBe('string');
            expect(user.auth_token).toBe(Buffer.from(user.username + ':' + user.password, 'latin1').toString('base64'));

            return client.record(endpoint);
        }).then((recorded) => {
            expect(recorded.path).toBe('/smoke');

            return request({
                url: client.server + '/smoke',
                auth: client.auth,
                resolveWithFullResponse: true,
            });
        }).then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toBe('smoke ok');
            expect(response.headers['content-type']).toContain('text/plain');
        });
    });

    it('asks unauthenticated callers for basic auth', () => {
        expect.assertions(2);

        return request({
            url: client.server + '/smoke',
            resolveWithFullResponse: true,
        }).then(() => {
            throw new Error('expected the request to fail');
        }, (error) => {
            expect(error.statusCode).toBe(401);
            expect(error.error).toBe('Unauthorized');
        });
    });

    it('serves the published schema files', () => {
        return request({
            url: client.server + '/fake-api-schema.json',
            resolveWithFullResponse: true,
        }).then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toContain('UserInfo');

            return request({
                url: client.server + '/fake-api.openapi.yaml',
                resolveWithFullResponse: true,
            });
        }).then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toContain('openapi:');
        });
    });

    it('does not treat an unknown action as registration', () => {
        expect.assertions(1);

        return client.register('smoke').then(() => {
            return request({
                method: 'post',
                url: client.server + '/not-an-endpoint',
                headers: {
                    'X-FakeAPI-Action': 'nope',
                },
                auth: client.auth,
            });
        }).then(() => {
            throw new Error('expected the request to fail');
        }, (error) => {
            expect(error.statusCode).toBe(404);
        });
    });
});

describe('CLI', () => {
    it('serves a recorded endpoint from bin/www', () => {
        const child = spawn(process.execPath, [path.join(__dirname, '../bin/www')], {
            env: Object.assign({}, process.env, { PORT: '0' }),
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';

        child.stdout.on('data', (chunk) => {
            output += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            output += chunk.toString();
        });

        const stopped = new Promise((resolve) => {
            child.on('exit', resolve);
        });

        return new Promise((resolve, reject) => {
            const started = Date.now();

            const waitForPort = () => {
                const match = output.match(/Listening at http:\/\/127\.0\.0\.1:(\d+)/);

                if (match) {
                    resolve(match[1]);
                    return;
                }

                if (Date.now() - started > 5000) {
                    reject(new Error('server did not listen: ' + output));
                    return;
                }

                setTimeout(waitForPort, 20);
            };

            waitForPort();
        }).then((port) => {
            const server = 'http://127.0.0.1:' + port;

            return request({
                method: 'post',
                uri: server,
                headers: {
                    'X-FakeAPI-Action': 'register',
                },
                body: { external_id: 'cli' },
                json: true,
                resolveWithFullResponse: true,
            }).then((response) => {
                const auth = {
                    user: response.body.username,
                    pass: response.body.password,
                };

                return request({
                    method: 'put',
                    uri: server,
                    headers: {
                        'X-FakeAPI-Action': 'record',
                    },
                    auth,
                    json: true,
                    body: {
                        method: 'get',
                        path: '/cli-hello',
                        responses: [
                            {
                                status: 200,
                                content: 'from the cli',
                                content_type: 'text/plain',
                            },
                        ],
                    },
                }).then(() => {
                    return request({
                        url: server + '/cli-hello',
                        auth,
                    });
                });
            });
        }).then((body) => {
            expect(body).toBe('from the cli');
        }).finally(() => {
            child.kill('SIGTERM');
            return stopped;
        });
    });
});
