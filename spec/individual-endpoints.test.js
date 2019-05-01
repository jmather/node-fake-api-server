const Promise = require('bluebird');
require('any-promise/register/bluebird');
const request = require('request-promise-any');

const helper = require('./test-helper');

/**
 * @type {FakeApiClient}
 */
let client = null;

beforeEach(() => {
    return helper.registeredClient().then(c => {
        client = c;
    })
});

afterEach(() => {
    helper.stopServer();
    client = null;
});

for (const endpointName in helper.endpoints) {
    if (helper.endpoints.hasOwnProperty(endpointName) === false) {
        continue;
    }

    if (endpointName.startsWith('bad_')) {
        continue;
    }

    // if (endpointName === 'hello_incremental')
    testEndpoint(endpointName, helper.endpoints[endpointName]);
}

/**
 *
 * @param {string} name
 * @param {Endpoint} endpoint
 */
function testEndpoint(name, endpoint) {
    it('responds to the ' + name + ' endpoint correctly', () => {
        expect.assertions(getAssertionCount(endpoint));

        return client.record(endpoint).then(() => {
            if (endpoint.response_mode === 'incremental') {
                return testIncrementalEndpoint(client, endpoint);
            }

            return testRandomEndpoint(client, endpoint);
        });
    });
}

/**
 * @param {Endpoint} endpoint
 */
function getAssertionCount(endpoint) {
    if (endpoint.response_mode === 'incremental') {
        return endpoint.responses.length * 4;
    }

    return endpoint.responses.length + 1;
}

/**
 *
 * @param {FakeApiClient} client
 * @param {Endpoint} endpoint
 */
function testIncrementalEndpoint(client, endpoint) {
    const req = getRequestTemplate(client, endpoint);

    return Promise.each(endpoint.responses, (response) => {
        const startedRequestAt = Date.now();
        return request(req).then(resp => {
            const runTime = (Date.now() - startedRequestAt) / 1000;
            expect(resp.statusCode).toBe(response.status);
            expect(resp.body).toBe(response.content);
            expect(resp.headers['content-type']).toContain(response.content_type);
            expect(runTime).toBeCloseTo(response.response_delay / 1000 || 0, 1);
        });
    });
}

/**
 *
 * @param {FakeApiClient} client
 * @param {Endpoint} endpoint
 */
function testRandomEndpoint(client, endpoint) {
    const req = getRequestTemplate(client, endpoint);

    let matchingResponses = 0;

    return Promise.each(endpoint.responses, (response) => {
        return request(req).then(resp => {
            if (doesResponseMatch(response, resp)) {
                matchingResponses++;
            }

            expect(resp).not.toBe(null);
        });
    }).then(() => {
        expect(matchingResponses).toBeLessThan(endpoint.responses.length);
    });
}

function doesResponseMatch(expected, actual) {
    if (actual.statusCode !== expected.status) {
        return false;
    }

    if (actual.body !== expected.content) {
        return false;
    }

    if (actual.headers['content-type'].startsWith(expected.content_type) === false) {
        return false;
    }

    return true;
}

/**
 *
 * @param {FakeApiClient} client
 * @param {Endpoint} endpoint
 */
function getRequestTemplate(client, endpoint) {
    return {
        method: endpoint.method,
        url: client.server + endpoint.path,
        auth: client.auth,
        headers: endpoint.headers,
        qs: endpoint.query_parameters,
        resolveWithFullResponse: true,
    };
}