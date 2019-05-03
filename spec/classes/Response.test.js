const Response = require('../../lib/classes/Response');

describe('Response', () => {
    it('uses defaults correctly', () => {
        const response = new Response();
        expect(response.status).toBe(200);
        expect(response.content).toBe('');
        expect(response.content_type).toBe('text/plain');
        expect(Object.keys(response.headers)).toHaveLength(0);
        expect(response.delay).toBe(0);
    });
});
