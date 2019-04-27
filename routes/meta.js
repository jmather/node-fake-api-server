const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, useDefaults: true});

const Endpoint = require('../models/Endpoint');
const UserManager = require('../services/user-manager');
const apiSchema = require('../public/fakeapi-schema');

class Meta {
    static register(req, res) {
        if (ajv.validate(createSchema('UserInfo'), req.body) === false) {
            res.badRequest(ajv.errorsText(), ajv.errors);
            return;
        }

        const user = res.locals.user = UserManager.create(req.body.external_id);

        const response = {
            username: user.username,
            password: user.password,
            auth_token: user.getAuthToken(),
        };

        res.created(response);
    }

    static record(req, res) {
        if (! res.locals.user) {
            res.unauthorized();
            return;
        }

        if (ajv.validate(createSchema('Endpoint'), req.body) === false) {
            res.badRequest(ajv.errorsText(), ajv.errors);
            return;
        }

        const endpoint = Endpoint.fromPayload(req.body);

        if (res.locals.user.addEndpoint(endpoint)) {
            res.created(req.body);
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
