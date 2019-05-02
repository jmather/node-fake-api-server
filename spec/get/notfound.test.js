const Promise = require('bluebird');
require('any-promise/register/bluebird');
const request = require('request-promise-any');

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

it('404s when it finds no match', () => {
    expect.assertions(2);

    const req = {
        url: client.server + '/hello-world',
        auth: client.auth,
    };

    return request(req).catch(error => {
        expect(error.statusCode).toBe(404);
        expect(error.error).toBe('Not Found');
    });
});

it('404s when it finds no match with a similar one registered', () => {
    expect.assertions(2);

    return client.record(helper.endpoints.post_hello_world).then(() => {
        const req = {
            url: client.server + '/hello-world',
            auth: client.auth,
        };

        return request(req).catch(error => {
            expect(error.statusCode).toBe(404);
            expect(error.error).toBe('Not Found');
        });
    });
});