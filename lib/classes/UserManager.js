const uuid = require('uuid');
const debug = require('debug')('fake-api:server:user-manager');
const User = require('./User');

class UserManager {
    /**
     *
     * @param {Object} options
     * @param {number} options.maxIdleMs Maximum idle time in ms of a user before purging.
     * @param {number} options.purgeIntervalMs Number of ms between purge cycles.
     */
    constructor(options) {
        options = options || {};

        /**
         * max idle time is 2 hours
         * @type {number}
         * @private
         */
        this._cleanupMaxAge = options.maxIdleMs || 1000 * 60 * 120;

        /**
         * we run a cleanup check every 15 minutes...
         * @type {number}
         * @private
         */
        this._cleanupInterval = options.purgeIntervalMs || 1000 * 60 * 15;

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

        debug('[_ensureCleanupStarted] turning on user cleanup.');

        this._scheduleNextCleanup();
    }

    _scheduleNextCleanup() {
        this._cleanupTimeout = setTimeout(() => this._runCleanup(), this._cleanupInterval);
    }

    _runCleanup() {
        debug('[_runCleanup] run beginning.');

        const max_age = Date.now() - this._cleanupMaxAge;
        let checked = 0;
        let purged = 0;

        for (const username in this.users) {
            if (this.users.hasOwnProperty(username) === false) {
                continue;
            }

            if (this.users[username].last_active < max_age) {
                debug('[_runCleanup] Purging user ' + username);
                delete this.users[username];
                purged++;
            }

            checked++;
        }

        debug('[_runCleanup] run complete.', { checked, purged });

        this._scheduleNextCleanup();
    }
}

module.exports = UserManager;