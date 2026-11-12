const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../conformance/assets/fake-api-schema.json');
const openApiPath = path.join(__dirname, '../conformance/assets/fake-api.openapi.yaml');
const schemaBytes = fs.readFileSync(schemaPath);
const openApiBytes = fs.readFileSync(openApiPath);

function sendDocument(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
    }

    if (req.path === '/fake-api-schema.json') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(req.method === 'HEAD' ? undefined : schemaBytes);
        return;
    }

    if (req.path === '/fake-api.openapi.yaml') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/yaml');
        res.end(req.method === 'HEAD' ? undefined : openApiBytes);
        return;
    }

    next();
}

module.exports = sendDocument;
