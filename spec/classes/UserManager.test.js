const crypto = require('crypto');
const { mock } = require('node:test');
const User = require('../../lib/classes/User');
const UserManager = require('../../lib/classes/UserManager');

let userManager = null;

describe('UserManager', () => {
    beforeEach(() => {
        userManager = new UserManager();
    });

    afterEach(() => {
        userManager = null;
    });

    it('purges expired users', () => {
        const user = new User('test', 'test', 'test');
        user.last_active = Date.now() - (userManager._cleanupMaxAge + 1);
        userManager.users.test = user;
        userManager._runCleanup();
        expect(userManager.users.test).toBe(undefined);
    });

    it('does not purge current users', () => {
        const user = new User('test', 'test', 'test');
        user.last_active = Date.now() - (userManager._cleanupMaxAge - 1);
        userManager.users.test = user;
        userManager._runCleanup();
        expect(userManager.users.test).toBe(user);
    });

    it ('handles colliding usernames correctly', () => {
        const str = '123';
        const username = 'new';
        const password = 'pass';

        const values = [str, str, username, password];
        const mocked = mock.method(crypto, 'randomUUID');
        mocked.mock.mockImplementation(() => values.shift());

        userManager.users[str] = true;

        try {
            const user = userManager.create('test');

            expect(user.username).toBe(username);
            expect(user.password).toBe(password);
            expect(mocked.mock.calls.length).toBe(4);
        } finally {
            mocked.mock.restore();
        }
    });
});
