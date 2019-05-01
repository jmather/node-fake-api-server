const uuid = require('uuid');
const User = require('../models/User');
const debug = require('debug')('fake-api:server:user-manager');

class UserManager {
    constructor() {
        /**
         * max idle time is 2 hours
         * @type {number}
         * @private
         */
        this._cleanupMaxAge = 1000 * 60 * 120;

        /**
         * we run a cleanup check every 15 minutes...
         * @type {number}
         * @private
         */
        this._cleanupInterval = 1000 * 60 * 15;

        /**
         * Storage var for the cleanup handler.
         * @type {ref}
         * @private
         */
        this._cleanupTimeout = null;

        /**
         *
         * @type {User}
         */
        this.users = {};
    }

    /**
     * Create a user.
     *
     * @param {string} external_id
     * @returns {User}
     */
    create(external_id) {
        let username = uuid.v4();

        while (this.users.hasOwnProperty(username)) {
            username = uuid.v4();
        }

        const user = new User(username, uuid.v4(), external_id);

        this.users[username] = user;

        this._ensureCleanupStarted();

        return user;
    }

    _ensureCleanupStarted() {
        if (this._cleanupTimeout) {
            return;
        }

        debug('[UserManager._ensureCleanupStarted] turning on user cleanup.');

        this._scheduleNextCleanup();
    }

    _scheduleNextCleanup() {
        this._cleanupTimeout = setTimeout(() => this._runCleanup(), this._cleanupInterval);
    }

    _runCleanup() {
        debug('[UserManager._runCleanup] run beginning.');

        const max_age = Date.now() - this._cleanupMaxAge;
        let checked = 0;
        let purged = 0;

        for (const username in this.users) {
            if (this.users.hasOwnProperty(username) === false) {
                continue;
            }

            if (this.users[username].last_active < max_age) {
                debug('[UserManager._runCleanup] Purging user ' + username);
                delete this.users[username];
                purged++;
            }

            checked++;
        }

        debug('[UserManager._runCleanup] run complete.', { checked, purged });

        this._scheduleNextCleanup();
    }
}

module.exports = new UserManager();