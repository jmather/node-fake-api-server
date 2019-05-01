class Response {
    /**
     *
     * @param {number} status
     * @param {string} content
     * @param {string} content_type
     * @param {object} headers
     * @param {number} response_delay
     */
    constructor(status, content, content_type, headers, response_delay) {
        this.status = status || 200;
        this.content = content || '';
        this.content_type = content_type || 'text/plain';
        this.headers = headers || {};
        this.response_delay = response_delay || 0;
    }
}

module.exports = Response;