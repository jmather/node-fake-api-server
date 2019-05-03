const Endpoint = require('../../lib/classes/Endpoint');

describe('Endpoint', () => {
    it('defaults to incremental', () => {
        const endpoint = new Endpoint(Endpoint.Methods.Get, '/foo', null, null, null, null);

        expect(endpoint.response_mode).toBe(Endpoint.ResponseModes.Incremental);
    });
});
