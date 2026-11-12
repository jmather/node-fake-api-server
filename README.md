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

## Logging and redaction hook

Every completed request writes one JSON line to stdout through [pino-http](https://github.com/pinojs/pino-http). The line uses the shared field names, in this order: `timestamp`, `level`, `msg`, `server`, `request_id`, `method`, `path`, `query`, `status`, `duration_ms`, `action`, `user`. `server` is `"node"`. `level` is `info`, `warn` for 4xx, and `error` for 5xx. The response header `X-Request-Id` is the same value as `request_id`.

Headers and bodies stay out of the log unless capture is turned on. With nothing set, the line has the fields above and nothing secret from the request or response bodies.

| `FAKEAPI_LOG_CAPTURE` | What is added |
| --- | --- |
| `none` (default) | Nothing. No `request` or `response` object. |
| `headers` | `request` and `response`, each with lowercased `headers` and `content_type`. |
| `all` | The same, plus the raw body string. Bodies are not parsed. They are cut at 64 KiB and the cut is marked with `…[truncated]`. |

`FAKEAPI_LOG_XML_PATH`, when set, also appends the same record to that file as one `<request-log>` element per line. Leave it unset and the XML sink stays off.

Redaction runs on the serialized string, after pino or the XML writer has produced it and before that string is written:

```javascript
const app = require('node-fake-api-server');

app.setRedactionHook((serialized, format) => {
    // format is "json" or "xml"
    return myRedactor.redact(serialized, format);
});
```

The default hook returns the string unchanged. `app.set('logging', false)` turns the request log off, which is what the test suite does.

Pino has its own [`redact` option](https://github.com/pinojs/pino/blob/main/docs/redaction.md), which removes values by object path before serialization. Use that when the paths are known ahead of time. This server does not. The redaction libraries take a JSON, XML, YAML, or text string and return a string, so the hook is the seam they plug into.

## Development

```bash
nvm use
npm ci
npm test
npm run lint
```
