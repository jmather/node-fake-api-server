const http = require('http');
const request = require('./request');

const app = require('../lib/app');

// Fetch refuses these ports ("bad port"). The old picker used 3000-4999, which
// includes 3659 and 4045, so a test would fail whenever it landed on one.
const FETCH_BLOCKED_PORTS = new Set([
    '1', '7', '9', '11', '13', '15', '17', '19', '20', '21', '22', '23', '25', '37', '42', '43', '53', '69', '77', '79',
    '87', '95', '101', '102', '103', '104', '109', '110', '111', '113', '115', '117', '119', '123', '135', '137',
    '139', '143', '161', '179', '389', '427', '465', '512', '513', '514', '515', '526', '530', '531', '532',
    '540', '548', '554', '556', '563', '587', '601', '636', '989', '990', '993', '995', '1719', '1720', '1723',
    '2049', '3659', '4045', '4190', '5060', '5061', '6000', '6566', '6665', '6666', '6667', '6668', '6669', '6679',
    '6697', '10080',
]);

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
            let settled = false;
            const finish = (error, client) => {
                if (settled) {
                    return;
                }

                settled = true;

                if (error) {
                    reject(error);
                    return;
                }

                accept(client);
            };

            const port = preferredPort == null || preferredPort === '' ? 0 : preferredPort;

            app.set('port', port);
            app.set('logging', false);

            this.server = http.createServer(app);

            this.server.on('listening', () => {
                const assigned = this.server.address().port;

                if (FETCH_BLOCKED_PORTS.has(String(assigned))) {
                    this.server.close(() => {
                        this.buildServer().then(
                            (client) => finish(null, client),
                            (error) => finish(error)
                        );
                    });
                    return;
                }

                finish(null, new TestClient('http://127.0.0.1:' + assigned));
            });

            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
                    this.buildServer().then(
                        (client) => finish(null, client),
                        (err) => finish(err)
                    );
                    return;
                }

                finish(error);
            });

            this.startListening(port);
        });
    }

    startListening(port) {
        this.server.listen(port, '127.0.0.1');
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
