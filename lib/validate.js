const Ajv = require('ajv');
const apiSchema = require('../conformance/assets/fake-api-schema.json');

const ajv = new Ajv({
    allErrors: true,
    jsonPointers: true,
    useDefaults: true,
});

function schemaFor(entity) {
    return {
        definitions: apiSchema.definitions,
        $ref: '#/definitions/' + entity,
    };
}

function pointerJoin(parent, name) {
    const escaped = String(name).replace(/~/g, '~0').replace(/\//g, '~1');

    if (!parent) {
        return '/' + escaped;
    }

    return parent + '/' + escaped;
}

function formatError(error) {
    const keyword = error.keyword;
    const params = error.params || {};
    let path = error.dataPath || '';
    let message;

    if (keyword === 'additionalProperties') {
        message = 'must not have additional property \'' + params.additionalProperty + '\'';
    } else if (keyword === 'required') {
        message = 'must have required property \'' + params.missingProperty + '\'';
    } else if (keyword === 'type') {
        const typeName = Array.isArray(params.type) ? params.type.join(' or ') : params.type;
        message = 'must be ' + typeName;
    } else if (keyword === 'enum') {
        const allowed = (params.allowedValues || []).map((value) => JSON.stringify(value)).join(', ');
        message = 'must be one of: ' + allowed;
    } else if (keyword === 'pattern') {
        if (error.propertyName) {
            return {
                keyword: 'propertyNames',
                path: pointerJoin(path, error.propertyName),
                message: 'property name \'' + error.propertyName + '\' is not allowed',
            };
        }

        message = 'must match pattern ' + params.pattern;
    } else if (keyword === 'format') {
        message = 'must be a valid ' + (params.format || error.schema);
    } else if (keyword === 'minimum') {
        message = 'must be >= ' + params.limit;
    } else if (keyword === 'maximum') {
        message = 'must be <= ' + params.limit;
    } else if (keyword === 'minItems') {
        message = 'must have at least ' + params.limit + ' items';
    } else if (keyword === 'maxItems') {
        message = 'must have at most ' + params.limit + ' items';
    } else if (keyword === 'minLength') {
        message = 'must be at least ' + params.limit + ' characters';
    } else if (keyword === 'maxLength') {
        message = 'must be at most ' + params.limit + ' characters';
    } else if (keyword === 'propertyNames') {
        path = pointerJoin(path, params.propertyName);
        message = 'property name \'' + params.propertyName + '\' is not allowed';
    } else {
        message = error.message || keyword;
    }

    return { keyword, path, message };
}

function formatErrors(errors) {
    const mapped = [];
    const seen = new Set();

    (errors || []).forEach((error) => {
        const formatted = formatError(error);
        const key = formatted.path + '\0' + formatted.keyword + '\0' + formatted.message;

        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        mapped.push(formatted);
    });

    mapped.sort((left, right) => {
        if (left.path < right.path) {
            return -1;
        }

        if (left.path > right.path) {
            return 1;
        }

        if (left.keyword < right.keyword) {
            return -1;
        }

        if (left.keyword > right.keyword) {
            return 1;
        }

        if (left.message < right.message) {
            return -1;
        }

        if (left.message > right.message) {
            return 1;
        }

        return 0;
    });

    return mapped;
}

function validate(entity, data) {
    const ok = ajv.validate(schemaFor(entity), data);

    if (ok) {
        return null;
    }

    return formatErrors(ajv.errors);
}

function parsePayload(buffer) {
    if (!buffer || buffer.length === 0) {
        return {
            error: {
                message: 'Request payload is malformed.',
                errors: [
                    { keyword: 'parse', path: '', message: 'Request body is empty.' },
                ],
            },
        };
    }

    let text;

    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        return {
            error: {
                message: 'Request payload is malformed.',
                errors: [
                    { keyword: 'parse', path: '', message: 'Request body is not valid UTF-8.' },
                ],
            },
        };
    }

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        return {
            error: {
                message: 'Request payload is malformed.',
                errors: [
                    { keyword: 'parse', path: '', message: 'Request body is not valid JSON.' },
                ],
            },
        };
    }

    return { data };
}

module.exports = {
    parsePayload,
    validate,
};
