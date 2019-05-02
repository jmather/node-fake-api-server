module.exports = class ContextError extends Error {
    constructor(message, data) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);

        this.message = message;
        this.data = data || {};
    }
};