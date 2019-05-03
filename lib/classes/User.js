const btoa = require('btoa');
const MultipleMatchError = require('./MultipleMatchError');

class User {
    /**
     * Create a user.
     *
     * @param {string} username
     * @param {string} password
     * @param {string} external_id
     */
    constructor(username, password, external_id) {
        this.username = username;
        this.password = password;
        this.external_id = external_id;
        this.auth_token = this.getAuthToken();
        this.last_active = Date.now();
        this.endpoints = {};
    }

    getAuthToken() {
        return btoa(this.username + ':' + this.password);
    }

    /**
     *
     * @param {Endpoint} endpoint
     */
    addEndpoint(endpoint) {
        const hash = endpoint.getHash();
        if (this.endpoints.hasOwnProperty(hash)) {
            return false;
        }

        this.endpoints[hash] = endpoint;

        return true;
    }

    findEndpoint(req) {
        const partial_hash = req.method.toLowerCase() + req.path;

        const possibleMatches = [];

        Object.keys(this.endpoints).forEach(key => {
            if (key.startsWith(partial_hash) === false) {
                return;
            }

            const matchCount = getEndpointMatchCount(this.endpoints[key], req);

            if (matchCount >= 0) {
                possibleMatches.push({ count: matchCount, endpoint: this.endpoints[key] });
            }
        });

        let bestMatches = [];
        let bestMatchCount = 0;

        possibleMatches.forEach(match => {
            if (match.count === bestMatchCount) {
                bestMatches.push(match.endpoint);
            }

            if (match.count > bestMatchCount) {
                bestMatchCount = match.count;
                bestMatches = [ match.endpoint ];
            }
        });

        if (bestMatches.length === 1) {
            return bestMatches[0];
        }

        if (bestMatches.length > 1) {
            throw new MultipleMatchError({ bestMatchCount, bestMatches, possibleMatches });
        }

        return null;
    }
}

function getEndpointMatchCount(endpoint, request) {
    let matches = 0;
    let bail = false;

    Object.keys(endpoint.headers).forEach(hKey => {
        if (bail) {
            return;
        }

        if (request.headers.hasOwnProperty(hKey) === false) {
            bail = true;
            return;
        }

        if (request.headers[hKey] !== endpoint.headers[hKey]) {
            bail = true;
            return;
        }

        matches++;
    });

    if (bail) {
        return -1;
    }

    Object.keys(endpoint.query_parameters).forEach(qKey => {
        if (bail) {
            return;
        }

        if (request.query.hasOwnProperty(qKey) === false) {
            bail = true;
            return;
        }

        if (request.query[qKey] !== endpoint.query_parameters[qKey]) {
            bail = true;
            return;
        }

        matches++;
    });

    if (bail) {
        return -1;
    }

    return matches;
}

module.exports = User;