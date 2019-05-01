const ContextError = require('./ContextError');

module.exports = class MultipleMatchError extends ContextError {
    constructor(data) {
        super('Multiple possible matches', data);
        this.status = 400;
    }
};
