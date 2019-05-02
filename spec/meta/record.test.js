const helper = require('../test-helper');

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

it('rejects unauthed request', () => {
    expect.assertions(2);

    const endpoint = helper.endpoints.hello_world;

    client.auth.pass = 'wrong';

    return client.record(endpoint)
        .catch(error => {
        expect(error.statusCode).toBe(401);
        expect(error.error).toBe('Unauthorized');
    });
});

it('rejects a bad record request', () => {
    expect.assertions(2);

    const endpoint = helper.endpoints.bad_hello_world;

    return client.record(endpoint).catch((error) => {
        expect(error.statusCode).toBe(400);
        expect(error.error.message).toContain('data.path should match pattern');
    });
});

it('handles a good record request', () => {
    expect.assertions(1);

    const endpoint = helper.endpoints.hello_world;

    return client.record(endpoint).then((endpointData) => {
        expect(endpointData).toEqual(endpoint);
    });
});
