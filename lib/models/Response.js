class Response {
    /**
     *
     * @param {number} status
     * @param {string} content
     * @param {string} content_type
     * @param {object} headers
     * @param {number} delay
     */
    constructor(status, content, content_type, headers, delay) {
        this.status = status || 200;
        this.content = content || '';
        this.content_type = content_type || 'text/plain';
        this.headers = headers || {};
        this.delay = delay || 0;
    }
}

module.exports = Response;