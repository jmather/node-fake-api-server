const User = require('../../lib/classes/User');
const UserManager = require('../../lib/classes/UserManager');

let userManager = null;

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