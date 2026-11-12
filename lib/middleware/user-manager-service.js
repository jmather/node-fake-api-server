const clock = require('../clock');
const UserManager = require('../classes/UserManager');

const idle = clock.settings();
const userManager = new UserManager({
    maxIdleMs: idle.maxIdleMs,
    purgeIntervalMs: idle.purgeIntervalMs,
    manualClock: idle.manual,
});

module.exports = (req, res, next) => {
    res.locals.user_manager = userManager;

    next();
};