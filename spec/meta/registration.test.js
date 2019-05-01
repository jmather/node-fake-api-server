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