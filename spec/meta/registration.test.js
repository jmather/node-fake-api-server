require('any-promise/register/bluebird');
const request = require('request-promise-any');

const helper = require('../test-helper');

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
