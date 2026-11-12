const request = require('../request');
const TestHelper = require('../helper');

const helper = new TestHelper();

describe('Body matching', () => {
    let client = null;

    beforeEach(() => {
        return helper.registeredClient().then((created) => {
            client = created;
        });
    });

    afterEach(() => {
        helper.stopServer();
        client = null;
    });

    it('prefers the endpoint whose raw body matches', () => {
        expect.assertions(2);

        const specific = {
            method: 'post',
            path: '/match-body',
            body: '{"kind":"alpha"}',
            responses: [
                {
                    status: 200,
                    content: 'alpha',
                    content_type: 'text/plain',
                },
            ],
        };
        const fallback = {
            method: 'post',
            path: '/match-body',
            responses: [
                {
                    status: 200,
                    content: 'fallback',
                    content_type: 'text/plain',
                },
            ],
        };

        return client.record(specific).then(() => {
            return client.record(fallback);
        }).then(() => {
            return request({
                method: 'post',
                url: client.server + '/match-body',
                headers: { 'content-type': 'application/json' },
                body: '{"kind":"alpha"}',
                auth: client.auth,
                resolveWithFullResponse: true,
            });
        }).then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toBe('alpha');
        });
    });

    it('uses an endpoint with no body when the raw body differs', () => {
        expect.assertions(1);

        const specific = {
            method: 'post',
            path: '/match-body-miss',
            body: 'only-this',
            responses: [
                {
                    status: 200,
                    content: 'specific',
                    content_type: 'text/plain',
                },
            ],
        };
        const fallback = {
            method: 'post',
            path: '/match-body-miss',
            responses: [
                {
                    status: 200,
                    content: 'fallback',
                    content_type: 'text/plain',
                },
            ],
        };

        return client.record(specific).then(() => {
            return client.record(fallback);
        }).then(() => {
            return request({
                method: 'post',
                url: client.server + '/match-body-miss',
                body: 'something-else',
                auth: client.auth,
            });
        }).then((body) => {
            expect(body).toBe('fallback');
        });
    });
});
