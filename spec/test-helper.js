require('../node_modules/iconv-lite/encodings');
const http = require('http');
const FakeApiClient = require('node-fake-api-client');

const app = require('../lib/app');

class TestHelper {
    constructor() {
        this.endpoints = TestHelper.endpoints;
    }

    /**
     *
     * @param {number} preferredPort Port to attempt to bind to first.
     * @returns {Promise<FakeApiClient>}
     */
    buildServer(preferredPort) {
        return new Promise((accept, reject) => {
            const port = preferredPort | Math.floor(Math.random() * 2000) + 3000;

            app.set('port', port);
            app.set('logging', false);

            this.server = http.createServer(app);

            this.server.on('listening', () => {
                // console.log('server running');
                accept(new FakeApiClient('http://127.0.0.1:' + port));
            });

            this.server.on('error', (error) => {
                // console.log(error);
                switch (error.code) {
                    case 'EACCES':
                    case 'EADDRINUSE':
                        return this.buildServer();

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
     * @returns {Promise<FakeApiClient>}
     */
    registeredClient() {
        return this.buildServer().then(client => {
            return client.register('node-fake-api-server-test').then(() => {
                return client;
            });
        });
    }

    stopServer() {
        this.server.close();
    }
}

TestHelper.endpoints = require('./endpoints');

module.exports = TestHelper;