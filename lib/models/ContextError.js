module.exports = class ContextError extends Error {
    constructor(message, data) {
        super(message + '\n' + JSON.stringify(data, null, 2));

        this.message = message;
        this.data = data || {};
    }
};