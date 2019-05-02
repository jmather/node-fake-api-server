const Ajv = require('ajv/lib/ajv');
const debug = require('debug')('fake-api:server:controllers:meta');

const ajv = new Ajv({ allErrors: true, useDefaults: true});

const Endpoint = require('../classes/Endpoint');
const apiSchema = require('../../public/fake-api-schema');

class Meta {
    static register(req, res) {
        const body = JSON.parse(req.body);
        if (ajv.validate(createSchema('UserInfo'), body) === false) {
            res.badRequest(ajv.errorsText(), ajv.errors);
            return;
        }

        debug('got user data', { userData: body });

        const user = res.locals.user = res.locals.user_manager.create(body.external_id);

        const response = {
            username: user.username,
            password: user.password,
            auth_token: user.auth_token,
        };

        res.created(response);
    }

    static record(req, res) {
        if (! res.locals.user) {
            res.unauthorized();
            return;
        }

        const body = JSON.parse(req.body);
        if (ajv.validate(createSchema('Endpoint'), body) === false) {
            res.badRequest(ajv.errorsText(), ajv.errors);
            return;
        }

        const endpoint = Endpoint.fromPayload(body);
        debug('got endpoint', { endpoint });
        if (res.locals.user.addEndpoint(endpoint)) {
            res.created(body);
            return;
        }

        res.sendStatus(409);
    }
}

function createSchema(entity) {
    return {
        '$schema': apiSchema['$schema'],
        definitions: apiSchema.definitions,
        '$ref': '#/definitions/' + entity,
    };
}

module.exports = Meta;
