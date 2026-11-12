const { after, afterEach, before, beforeEach, describe, it } = require('node:test');
const expect = require('./expect');

global.describe = describe;
global.it = (name, fn, options) => {
    return it(name, () => expect.runWithAssertions(fn), options);
};
global.beforeAll = before;
global.afterAll = after;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.expect = expect;
