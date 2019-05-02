const UserManager = require('../classes/UserManager');

const userManager = new UserManager();

module.exports = (req, res, next) => {
    res.locals.user_manager = userManager;

    next();
};