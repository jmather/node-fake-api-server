require('any-promise/register/bluebird');
const request = require('request-promise-any');

const TestHelper = require('../test-helper');
const helper = new TestHelper();

describe('Get Controller', () => {
    describe('Unauthenticated Handling', () => {
        /**
         * @type {FakeApiClient}
         */
        let client = null;

        beforeEach(() => {
            return helper.registeredClient().then(c => {
                client = c;
            });
        });

        afterEach(() => {
            helper.stopServer();
            client = null;
        });

        it('errors when it can match multiple endpoints', () => {
            expect.assertions(2);
            return client.record(helper.endpoints.hello_foo).then(() => {
                const req = {
                    url: client.server + '/hello-world',
                    qs: {
                        who: 'foo',
                    },
                };

                return request(req).catch(error => {
                    expect(error.statusCode).toBe(401);
                    expect(error.error).toBe('Unauthorized');
                });
            });
        });
    });
});