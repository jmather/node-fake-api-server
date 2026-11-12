const ContextError = require('./ContextError');

module.exports = class MultipleMatchError extends ContextError {
    constructor(data) {
        super('Conflict', data);
        this.status = 409;
        this.plain = true;
    }
};
