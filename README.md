# Fake API Server

[![CI](https://github.com/jmather/node-fake-api-server/actions/workflows/ci.yml/badge.svg)](https://github.com/jmather/node-fake-api-server/actions/workflows/ci.yml)

Register collections of arbitrary endpoints and mock their responses, so you can test your code end to end.

Pair it with the [Fake API Client](https://github.com/jmather/node-fake-api-client). This server still speaks that client's HTTP contract:

- `POST /` with header `X-FakeAPI-Action: register` and a JSON body `{ "external_id": "..." }`
- `PUT /` with header `X-FakeAPI-Action: record`, HTTP Basic auth, and an endpoint JSON body
- any other method or path is matched against the recorded endpoints for that user

## Requirements

Node.js 26 or newer. Node.js 26 ("Lithium") is the Active LTS line as of November 2026. `.nvmrc` pins that major.

## Schema

Request payloads are described by an [OpenAPI document](public/fake-api.openapi.yaml) and a [JSON Schema](public/fake-api-schema.json). A running server also serves those files at `/fake-api.openapi.yaml` and `/fake-api-schema.json`.

## Usage

### Run locally

```bash
npm install -g node-fake-api-server
fake-api-server
```

The process listens on `PORT`, or port 3000 when `PORT` is unset.

### Public URL

```bash
export NGROK_AUTHTOKEN=your-token
fake-api-server --public
```

`--public` opens a tunnel with the official `@ngrok/ngrok` SDK. Create a token at <https://dashboard.ngrok.com/get-started/your-authtoken>. The server stays on localhost when the flag is omitted, and it does not contact ngrok in that case.

### Run in code

The package is CommonJS. `require('node-fake-api-server')` is the Express app.

```javascript
const http = require('http');
const app = require('node-fake-api-server');

const port = Math.floor(Math.random() * 2000) + 3000;

app.set('port', port);

const server = http.createServer(app);
server.listen(port);
```

### Example

```bash
curl -s -X POST http://127.0.0.1:3000/ \
  -H 'Content-Type: application/json' \
  -H 'X-FakeAPI-Action: register' \
  -d '{"external_id":"demo"}'

curl -s -X PUT http://127.0.0.1:3000/ \
  -u 'USERNAME:PASSWORD' \
  -H 'Content-Type: application/json' \
  -H 'X-FakeAPI-Action: record' \
  -d '{"method":"get","path":"/hello","responses":[{"status":200,"content":"Hello World!","content_type":"text/plain"}]}'

curl -s -u 'USERNAME:PASSWORD' http://127.0.0.1:3000/hello
```

Use the `username` and `password` from the register response in the later commands.

## Development

```bash
nvm use
npm ci
npm test
npm run lint
```
