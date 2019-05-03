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

        const mockV4 = jest.fn();
        mockV4
            .mockReturnValueOnce(str)
            .mockReturnValueOnce(str)
            .mockReturnValueOnce(username)
            .mockReturnValueOnce(password);

        const uuid = require('uuid');
        const oldV4 = uuid.v4;
        uuid.v4 = mockV4;

        userManager.users[str] = true;

        const user = userManager.create('test');
        uuid.v4 = oldV4;

        expect(user.username).toBe(username);
        expect(user.password).toBe(password);
        expect(mockV4.mock.calls).toHaveLength(4);
    });
});
