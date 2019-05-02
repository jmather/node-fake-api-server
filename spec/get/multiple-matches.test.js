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

it('errors when it can match multiple endpoints', () => {
    expect.assertions(2);
    return client.record(helper.endpoints.hello_foo).then(() => {
        return client.record(helper.endpoints.hello_bar).then(() => {
            const req = {
                url: client.server + '/hello-world',
                qs: {
                    who: 'foo',
                },
                headers: {
                    'x-whom': 'bar',
                },
                auth: client.auth,
            };

            return request(req).catch(error => {
                expect(error.statusCode).toBe(400);
                const body = JSON.parse(error.error);
                expect(body.errors[0].message).toBe('Multiple possible matches');
            });
        });
    });
});

it('finds the right match', () => {
    expect.assertions(2);
    return client.record(helper.endpoints.hello_world).then(() => {
        const endpoint = helper.endpoints.hello_bar;
        return client.record(endpoint).then(() => {
            const req = {
                url: client.server + '/hello-world',
                headers: {
                    'x-whom': 'bar',
                },
                auth: client.auth,
                resolveWithFullResponse: true,
            };

            return request(req).then(response => {
                expect(response.statusCode).toBe(endpoint.responses[0].status);
                expect(response.body).toBe('Hello Bar!');
            });
        });
    });
});