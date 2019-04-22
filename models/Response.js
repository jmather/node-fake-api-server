class Response {
    /**
     * HTTP Status to return with
     * @type {number}
     */
    status = 200;

    /**
     * Content to return with
     * @type {string}
     */
    content = "";

    /**
     * Content type to return with
     * @type {string}
     */
    content_type = "text/plain";

    /**
     * Delay (in ms) before responding
     * @type {number}
     */
    response_delay = 0;

    /**
     *
     * @param {number} status
     * @param {string} content
     * @param {string} content_type
     * @param {number} response_delay
     */
    constructor(status, content, content_type, response_delay) {
        this.status = status;
        this.content = content;
        this.content_type = content_type;
        this.response_delay = response_delay;
    }
}

module.exports = Response;