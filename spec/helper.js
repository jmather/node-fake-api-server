const http = require('http');
const request = require('./request');

const app = require('../lib/app');

/**
 * HTTP calls match jmather/node-fake-api-client: POST register, PUT record,
 * HTTP Basic on later calls. Kept in-repo so tests do not depend on the
 * client's abandoned `request` package.
 */
class TestClient {
    /**
     * @param {string} server
     */
    constructor(server) {
        this.server = server;
        this.auth = {
            user: null,
            pass: null,
        };
    }

    /**
     * @param {string} external_id
     * @returns {Promise<object>}
     */
    register(external_id) {
        return request({
            method: 'post',
            uri: this.server,
            headers: {
                'X-FakeAPI-Action': 'register',
            },
            body: {
                external_id: external_id || 'node-fake-api.js-client',
            },
            json: true,
            resolveWithFullResponse: true,
        }).then((response) => {
            const userData = response.body;
            this.auth.user = userData.username;
            this.auth.pass = userData.password;
            return userData;
        });
    }

    /**
     * @param {object} endpoint
     * @returns {Promise<object>}
     */
    record(endpoint) {
        return request({
            method: 'put',
            uri: this.server,
            headers: {
                'X-FakeAPI-Action': 'record',
            },
            body: endpoint,
            json: true,
            auth: this.auth,
            resolveWithFullResponse: true,
        }).then((response) => response.body);
    }
}

class TestHelper {
    constructor() {
        this.endpoints = TestHelper.endpoints;
    }

    /**
     *
     * @param {number} preferredPort Port to attempt to bind to first.
     * @returns {Promise<TestClient>}
     */
    buildServer(preferredPort) {
        return new Promise((accept, reject) => {
            const port = preferredPort || Math.floor(Math.random() * 2000) + 3000;

            app.set('port', port);
            app.set('logging', false);

            this.server = http.createServer(app);

            this.server.on('listening', () => {
                accept(new TestClient('http://127.0.0.1:' + port));
            });

            this.server.on('error', (error) => {
                switch (error.code) {
                    case 'EADDRINUSE':
                    case 'EACCES':
                        return this.buildServer().then(accept);

                    default:
                        reject(error);
                }
            });

            this.startListening(port);
        });
    }

    startListening(port) {
        this.server.listen(port);
    }

    /**
     *
     * @returns {Promise<TestClient>}
     */
    registeredClient() {
        return this.buildServer().then(client => {
            return client.register('node-fake-api-server-test').then(() => {
                return client;
            });
        });
    }

    stopServer() {
        if (!this.server) {
            return;
        }

        if (typeof this.server.closeAllConnections === 'function') {
            this.server.closeAllConnections();
        }

        this.server.close();
    }
}

TestHelper.endpoints = require('./endpoints');

module.exports = TestHelper;
