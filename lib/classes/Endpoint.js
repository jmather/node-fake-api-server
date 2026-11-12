const crypto = require('crypto');
const debug = require('debug')('fake-api:server:classes:endpoint');
const Response = require('./Response');

class Endpoint {
    constructor(method, path, headers, query_parameters, response_mode, responses, body) {
        this.method = method;
        this.path = path;
        this.body = body == null ? null : String(body);
        this.headers = {};
        this.query_parameters = query_parameters || {};
        this.response_mode = response_mode || Endpoint.ResponseModes.Incremental;
        this.responses = [];
        this.response_index = 0;

        Object.keys(headers || {}).forEach(hKey => {
            this.headers[hKey.toLowerCase()] = headers[hKey];
        });

        const addResponse = (r) => {
            const response = new Response(r.status, r.content, r.content_type, r.headers, r.delay);
            this.responses.push(response);
        };

        if (responses) {
            responses.forEach(addResponse);
        }
    }

    getHash() {
        return this.method.toLowerCase()
            + this.path
            + JSON.stringify(this.body)
            + JSON.stringify(this.headers)
            + JSON.stringify(this.query_parameters);
    }

    getNextResponse() {
        return new Promise((accept) => {
            if (this.response_mode === Endpoint.ResponseModes.Random) {
                // Node 26's crypto.randomInt() returns the integer directly.
                this.response_index = crypto.randomInt(0, this.responses.length);
                debug('Random Response Selection', { response_count: this.responses.length, response_selected: this.response_index });
            }

            const response = this.responses[this.response_index];

            if (this.response_mode === Endpoint.ResponseModes.Incremental && this.responses.length > 1) {
                this.response_index++;
            }

            if (this.response_index >= this.responses.length) {
                this.response_index = 0;
            }

            accept(response);
        });
    }

    /**
     *
     * @param {Object} payload
     * @returns {Endpoint}
     */
    static fromPayload(payload) {
        return new Endpoint(
            payload.method,
            payload.path,
            payload.headers,
            payload.query_parameters,
            payload.response_mode,
            payload.responses,
            payload.body
        );
    }
}

Endpoint.Methods = Object.freeze({
    Get: 'get',
    Post: 'post',
    Put: 'put',
    Patch: 'patch',
    Delete: 'delete',
    Head: 'head',
    Options: 'options',
});

Endpoint.ResponseModes = Object.freeze({
    Incremental: 'incremental',
    Random: 'random',
});

module.exports = Endpoint;