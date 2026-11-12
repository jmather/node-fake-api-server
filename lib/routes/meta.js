const debug = require('debug')('fake-api:server:controllers:meta');

const Endpoint = require('../classes/Endpoint');
const { parsePayload, validate } = require('../validate');

class Meta {
    static register(req, res) {
        const parsed = parsePayload(req.body);

        if (parsed.error) {
            res.badRequest(parsed.error.message, parsed.error.errors);
            return;
        }

        const errors = validate('UserInfo', parsed.data);

        if (errors) {
            res.badRequest('Request payload is invalid.', errors);
            return;
        }

        debug('got user data', { userData: parsed.data });

        const user = res.locals.user_manager.create(parsed.data.external_id, res.locals.now);
        res.locals.user = user;

        res.created({
            username: user.username,
            password: user.password,
            auth_token: user.auth_token,
        });
    }

    static record(req, res) {
        if (!res.locals.user) {
            res.unauthorized();
            return;
        }

        const parsed = parsePayload(req.body);

        if (parsed.error) {
            res.badRequest(parsed.error.message, parsed.error.errors);
            return;
        }

        const errors = validate('Endpoint', parsed.data);

        if (errors) {
            res.badRequest('Request payload is invalid.', errors);
            return;
        }

        const endpoint = Endpoint.fromPayload(parsed.data);
        debug('got endpoint', { endpoint });

        if (res.locals.user.addEndpoint(endpoint)) {
            res.created(parsed.data);
            return;
        }

        res.plain(409, 'Conflict');
    }
}

module.exports = Meta;
