const { after, afterEach, before, beforeEach, describe, it } = require('node:test');
const expect = require('./expect');

global.describe = describe;

function registeredIt(name, optionsOrFn, maybeFn) {
    if (typeof optionsOrFn === 'function') {
        return it(name, () => expect.runWithAssertions(optionsOrFn));
    }

    return it(name, optionsOrFn, () => expect.runWithAssertions(maybeFn));
}

registeredIt.skip = it.skip;
global.it = registeredIt;
global.beforeAll = before;
global.afterAll = after;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.expect = expect;
