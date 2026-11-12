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
        return Buffer.from(this.username + ':' + this.password, 'utf8').toString('base64');
    }

    /**
     *
     * @param {Endpoint} endpoint
     */
    addEndpoint(endpoint) {
        const hash = endpoint.identityKey();
        if (Object.hasOwn(this.endpoints, hash)) {
            return false;
        }

        this.endpoints[hash] = endpoint;

        return true;
    }

    findEndpoint(req) {
        const method = req.method.toLowerCase();
        const candidates = [];

        Object.keys(this.endpoints).forEach((key) => {
            const endpoint = this.endpoints[key];

            if (endpoint.method.toLowerCase() !== method || endpoint.path !== req.path) {
                return;
            }

            const matchCount = getEndpointMatchCount(endpoint, req);

            if (matchCount >= 0) {
                candidates.push({ count: matchCount, endpoint });
            }
        });

        let bestMatches = [];
        let bestMatchCount = -1;

        candidates.forEach((match) => {
            if (match.count === bestMatchCount) {
                bestMatches.push(match.endpoint);
            }

            if (match.count > bestMatchCount) {
                bestMatchCount = match.count;
                bestMatches = [match.endpoint];
            }
        });

        if (bestMatches.length === 1) {
            return bestMatches[0];
        }

        if (bestMatches.length > 1) {
            throw new MultipleMatchError({ bestMatchCount, bestMatches });
        }

        return null;
    }
}

function getEndpointMatchCount(endpoint, request) {
    let matches = 0;
    let bail = false;

    if (endpoint.body != null) {
        if ((request.fakeBodyText || '') !== endpoint.body) {
            return -1;
        }

        matches++;
    }

    Object.keys(endpoint.headers).forEach(hKey => {
        if (bail) {
            return;
        }

        if (Object.hasOwn(request.headers, hKey) === false) {
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

    const query = request.fakeQueryMatch || {};

    Object.keys(endpoint.query_parameters).forEach(qKey => {
        if (bail) {
            return;
        }

        if (Object.hasOwn(query, qKey) === false) {
            bail = true;
            return;
        }

        if (query[qKey] !== endpoint.query_parameters[qKey]) {
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