const assert = require('node:assert/strict');
const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

function store() {
    const current = storage.getStore();

    if (!current) {
        throw new Error('expect() was called outside a test');
    }

    return current;
}

function count() {
    store().count += 1;
}

/**
 * Jest-shaped assertions for the node:test runner. Only the matchers this
 * suite already used are implemented.
 *
 * @param {*} actual
 */
function expect(actual) {
    const api = {
        toBe(expected) {
            count();
            assert.strictEqual(actual, expected);
        },
        toEqual(expected) {
            count();
            assert.deepStrictEqual(actual, expected);
        },
        toBeCloseTo(expected, precision) {
            count();
            const digits = precision === undefined ? 2 : precision;
            const delta = (10 ** -digits) / 2;
            assert.ok(
                Math.abs(actual - expected) < delta,
                actual + ' is not close to ' + expected
            );
        },
        toHaveLength(expected) {
            count();
            assert.strictEqual(actual.length, expected);
        },
        toContain(expected) {
            count();
            assert.ok(
                actual !== undefined && actual !== null && actual.includes(expected),
                String(actual) + ' does not contain ' + expected
            );
        },
        toBeLessThan(expected) {
            count();
            assert.ok(actual < expected, actual + ' is not less than ' + expected);
        },
    };

    api.not = {
        toBe(expected) {
            count();
            assert.notStrictEqual(actual, expected);
        },
        toEqual(expected) {
            count();
            assert.notDeepStrictEqual(actual, expected);
        },
    };

    return api;
}

expect.assertions = (expected) => {
    store().expected = expected;
};

function runWithAssertions(fn) {
    return storage.run({ expected: null, count: 0 }, async () => {
        await fn();

        const current = storage.getStore();

        if (current.expected !== null && current.count !== current.expected) {
            throw new Error(
                'Expected ' + current.expected + ' assertions, received ' + current.count
            );
        }
    });
}

module.exports = expect;
module.exports.runWithAssertions = runWithAssertions;
