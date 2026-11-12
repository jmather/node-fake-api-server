const request = require('../request');

const TestHelper = require('../helper');
const helper = new TestHelper();

describe('Meta Controller', () => {
    describe('Registration', () => {
        /**
         * @type {FakeApiClient}
         */
        let client = null;

        beforeEach(() => {
            return helper.buildServer().then(c => {
                client = c;
            });
        });

        afterEach(() => {
            helper.stopServer();
            client = null;
        });

        it('handles a registration request', () => {
            expect.assertions(3);

            return client.register('test').then((userData) => {
                /** @var userData {RegistrationResponse} */
                expect(userData.username).not.toEqual(null);
                expect(userData.password).not.toEqual(null);
                expect(userData.auth_token).not.toEqual(null);
            });
        });

        it('accepts the action header in any case', () => {
            expect.assertions(2);

            return request({
                method: 'post',
                uri: client.server,
                headers: {
                    'X-FakeAPI-Action': 'ReGiStEr',
                },
                body: {
                    external_id: 'case',
                },
                json: true,
                resolveWithFullResponse: true,
            }).then((response) => {
                expect(response.statusCode).toBe(201);
                expect(response.body.username).not.toEqual(null);
            });
        });

        it('rejects a bad request', () => {
            expect.assertions(2);

            const registerRequest = {
                method: 'post',
                uri: client.server,
                headers: {
                    'X-FakeAPI-Action': 'register',
                },
                body: {
                    broken: true,
                },
                json: true,
                resolveWithFullResponse: true,
            };

            return request(registerRequest).catch(error => {
                expect(error.statusCode).toBe(400);
                expect(error.error.message).toBe('data should NOT have additional properties');
            });
        });
    });
});
