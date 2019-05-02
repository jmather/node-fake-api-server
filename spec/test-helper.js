require('../node_modules/iconv-lite/encodings');
const http = require('http');
const FakeApiClient = require('node-fake-api-client');

const app = require('../lib/app');

class TestHelper {
    /**
     *
     * @returns {Promise<FakeApiClient>}
     */
    static buildServer() {
        return new Promise((accept, reject) => {
            const port = Math.floor(Math.random() * 2000) + 3000;

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

            this.server.listen(port);

            // console.log('server created');
        });
    }

    /**
     *
     * @returns {Promise<FakeApiClient>}
     */
    static registeredClient() {
        return this.buildServer().then(client => {
            return client.register('node-fake-api-server-test').then(() => {
                return client;
            });
        });
    }

    static stopServer() {
        this.server.close();
    }
}

TestHelper.endpoints = require('./endpoints');

module.exports = TestHelper;