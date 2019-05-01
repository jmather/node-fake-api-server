const Response = require('./Response');

class Endpoint {
    constructor(method, path, headers, query_parameters, response_mode, responses) {
        this.method = method;
        this.path = path;
        this.headers = {};
        this.query_parameters = query_parameters || {};
        this.response_mode = response_mode || this.ResponseModes.Incremental;
        this.responses = [];
        this.response_index = 0;

        if (headers) {
            for (const hKey in headers) {
                if (headers.hasOwnProperty(hKey) === false) {
                    continue;
                }

                this.headers[hKey.toLowerCase()] = headers[hKey];
            }
        }

        const addResponse = (r) => {
            const response = new Response(r.status, r.content, r.content_type, r.headers, r.delay);
            this.responses.push(response);
        };

        responses.forEach(addResponse);
    }

    getHash() {
        return this.method.toLowerCase() + this.path + JSON.stringify(this.headers) + JSON.stringify(this.query_parameters);
    }

    getNextResponse() {
        if (this.response_mode === Endpoint.ResponseModes.Random) {
            this.response_index = Math.floor(Math.random() * this.responses.length);
        }

        const response = this.responses[this.response_index];

        if (this.response_mode === Endpoint.ResponseModes.Incremental && this.responses.length > 1) {
            this.response_index++;
        }

        if (this.response_index >= this.responses.length) {
            this.response_index = 0;
        }

        return response;
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
            payload.responses
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