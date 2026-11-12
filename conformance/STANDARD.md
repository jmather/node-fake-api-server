# Fake API server behavior standard v1

Goal: the .NET (FakeApi.Server.AspNetCore), Node (node-fake-api-server) and Python (python-fake-api-server) servers are boringly identical over HTTP. Approved by Jacob Mather 2026-11-12. The shared conformance suite is the source of truth; where this doc and the suite disagree, fix one so they agree.

Concrete choices for every "proposed" or "pick one" point are in **Decisions** below and are what `conformance/fixtures/` asserts. `conformance/README.md` is the fixture format and the runner contract.

## Matching

- Method and path must match exactly (no prefix matching; `/hello` must not answer `/hello-world` or `/hello-world-extra`, and `/hell` must not answer a recorded `/hello`). The HTTP method comparison is case-insensitive. Recorded methods are the schema's lowercase enum.
- The query string is not part of the path. It is a scored constraint only when the recording sets `query_parameters`.
- Header names match case-insensitively on both the recording and the incoming request. Header values are case-sensitive. Recorded header names are compared in lowercase.
- `body` is optional on a recording. When the property is absent, the body is not a constraint and does not add to the score. When it is present, including `""`, it is compared as raw text (UTF-8, invalid bytes replaced with U+FFFD), adds 1 to the score, and is part of duplicate detection.
- Every recorded header and every recorded query parameter is required. Extra incoming headers or query parameters do not add to the score and do not disqualify a candidate. The highest score wins.
- Query values used for matching are application/x-www-form-urlencoded-decoded (`+` is a space, `%XX` is decoded). A repeated key is one constraint value: the decoded values joined with `,` (comma, no space), in encounter order.
- A tie between equally scored recordings is **409** with body `Conflict`. See Decisions.

## Actions

- Only `POST /` with action `register` and `PUT /` with action `record` are meta actions. Every other combination, including `PUT /` + `register`, `POST /` + `record`, and either action on any other path, is playback.
- The action header value is case-insensitive (`ReGiStEr`, `RECORD`). The log records the header value as received, not the folded form.
- The header name is `X-FakeApi-Action`, matched case-insensitively like any other header.

## Auth

- Basic and Bearer both authenticate. The scheme token is `base64(username + ":" + password)` (standard base64, UTF-8, with `=` padding). The scheme keyword is case-insensitive. The token is split on the first colon only, so the password may contain colons.
- A credential that is missing, uses another scheme, is not decodable, or does not match a live user is **401**. It is not a 500.
- A successful authentication refreshes that user's idle timer. A failed authentication does not. Register creates a user and sets the timer; it is not itself a login.
- Idle limit 2 hours. A user is removed when `now - last_active > 2 hours` (the exact 2 hour mark is still valid). A sweep runs every 15 minutes. The conformance clock and the TTL overrides are in Decisions.
- `WWW-Authenticate` on every 401 is `Basic realm="FakeAPI"` (quotes included). It is absent on other statuses.

## Errors

- 401, 404, and 409 bodies are the exact bytes `Unauthorized`, `Not Found`, and `Conflict`. No trailing newline. `Content-Type` is `text/plain; charset=utf-8`.
- 409 is used both for a duplicate recording and for a playback tie. The request method and path tell them apart.
- Validation failures are **400** with the shared JSON shape in Decisions. `Content-Type` is `application/json; charset=utf-8`.

## Shared surface

- Register and record payloads are validated against `assets/fake-api-schema.json` (JSON Schema draft-07). Defaults are applied before validation (`external_id` `""`, `method` `get`, `response_mode` `incremental`, response `status` `200`, response `delay` `0`). Invalid payloads use the shared 400 shape.
- `GET /fake-api-schema.json` and `GET /fake-api.openapi.yaml` require no auth and return the bytes in `conformance/assets/`, with content types `application/json; charset=utf-8` and `application/yaml`.
- CORS reflects the request `Origin`, allows credentials, and answers preflight as specified in Decisions.
- `delay` waits the full recorded number of milliseconds. Elapsed time and an overhead allowance are not subtracted.
- Playback sends the recorded `content_type` as the `Content-Type` value unchanged. Recorded response headers are copied except `content-length`, `transfer-encoding`, and `content-type`.
- A 201 from register or record includes `Location` set to the absolute URL the client requested.
- Register's JSON body is exactly `username`, `password`, and `auth_token`. `auth_token` is the Basic/Bearer token above. Record's 201 body is the request object after defaults are applied, with no properties added that the client omitted and that have no default.
- Every response, including 401, 404, 400, 204, schema documents, and preflight, carries `X-Request-Id`, a lowercase `8-4-4-4-12` hex UUID, equal to the log record's `request_id`.
- `response_mode` `incremental` walks the response list and wraps. `random` chooses uniformly. The suite locks incremental wrap. Random is not asserted, because a single draw is not deterministic.

## Logging

logging-spec.md v1 applies unchanged, plus the decisions below.

- New object hook: `redact_record(record) -> record`, called on the record object before serialization. The existing string hook `(serialized, format) -> string` still runs after serialization. Both default to identity. Order for each request: object hook once, then each sink serializes, then that sink's string hook. A thrown object hook, or a non-object return, skips both sinks and does not fail the HTTP response. A thrown string hook skips that sink's write.
- Configured the same way as each server's string hook. In Python that is a callable argument to `create_app` (`record_hook` / `log_hook`) which wins over `FAKEAPI_LOG_RECORD_HOOK` / `FAKEAPI_LOG_HOOK`. Those variables are a dotted path (`package.module:function` or `package.module.function`) or an entry-point name (`fakeapi.log_record_hooks` / `fakeapi.log_hooks`).
- `user` is the username from a **Basic** `Authorization` header when that header decodes to `username:password`. Bearer, a missing header, and an undecodable header log `user` as null. The password is never logged as `user`.
- `action` is the raw `X-FakeApi-Action` value, or null when the header is absent.
- `query` in the log uses decoded keys (`+` and `%XX`) and **raw** values (percent-encoding preserved). A repeated key is an array of the raw values in encounter order. One value stays a string. This is different from query matching, which decodes values.
- `content_type` inside a captured request or response is the header value, or `""` when the header is absent. It is never null.
- Bodies are the raw text, capped at 65536 bytes. The cut is `prefix.decode("utf-8", "ignore") + "…[truncated]"` (U+2026). Under the cap, undecodable bytes become U+FFFD.
- `timestamp` is RFC 3339 UTC with exactly three millisecond digits and a `Z` suffix: `YYYY-MM-DDTHH:MM:SS.mmmZ`.
- `duration_ms` is a non-negative JSON number. The suite checks the type and, for the delay scenario, a minimum. It does not pin the exact value.
- `level` is `info`, `warn` for 4xx, `error` for 5xx. `msg` is `request completed`. `server` is `python`, `dotnet`, or `node`.
- With `FAKEAPI_LOG_CAPTURE` unset or `none`, the record has exactly the base fields and no `request` or `response` object. `headers` adds those objects with `headers` and `content_type` and no `body`. `all` also includes the raw bodies.
- The XML sink is one `<request-log>` element per record, newline-delimited, written only when `FAKEAPI_LOG_XML_PATH` is set. Null `action` and `user` are empty elements. Newlines inside text are character references so each record stays one line. An XML parser restores them.
- Cursed test (`FAKEAPI_CURSED=1`) runs in three modes: string-hook only, object-hook only, and both. It parses each JSON line and each XML element and searches the decoded values (JSON strings and keys; XML text, tails, and attributes), not the raw serialized text. Report per mode and per sensitivity. A secret-ish miss is soft unless `FAKEAPI_CURSED_STRICT=1`. The placeholder hooks are identity, so the test fails until a real redactor is installed via `FAKEAPI_LOG_HOOK` and/or `FAKEAPI_LOG_RECORD_HOOK`.

## Allowed differences

- ngrok tunnel stays a Node-only extra. It is not in this suite.
- Each server keeps its own idiomatic launch and CLI.
- JSON key order and insignificant whitespace are not part of the contract. The suite compares JSON as parsed values. Plain-text bodies and the two schema documents are byte-exact.
- The suite does not assert an unhandled-exception 500 body. That remains local.

## Decisions

These are the choices the suite encodes. They replace the open points in the original draft.

### Tie

Playback that matches two or more recordings with the same best score returns **409**, `Content-Type: text/plain; charset=utf-8`, body `Conflict`. The log level is `warn`. Duplicate record uses the same status and body.

### 400 body

`Content-Type: application/json; charset=utf-8`.

Schema failure:

```json
{
  "message": "Request payload is invalid.",
  "errors": [
    {"keyword": "<json-schema keyword>", "path": "<json pointer>", "message": "<text below>"}
  ]
}
```

Parse failure (`message` is `Request payload is malformed.`):

| condition | keyword | path | message |
| --- | --- | --- | --- |
| empty body | `parse` | `""` | `Request body is empty.` |
| body is not UTF-8 | `parse` | `""` | `Request body is not valid UTF-8.` |
| body is not JSON | `parse` | `""` | `Request body is not valid JSON.` |

`path` is a JSON Pointer. The document root is an empty string, not `"/"`. `~` and `/` in a segment are escaped as `~0` and `~1`.

Errors are sorted by `(path, keyword, message)`. Messages, by keyword:

| keyword | message |
| --- | --- |
| `additionalProperties` | `must not have additional property '<name>'`, one error per extra name |
| `required` | `must have required property '<name>'`, one error per missing name |
| `type` | `must be <type>` (`string`, `object`, `integer`, …). A list of types is joined with ` or `. |
| `enum` | `must be one of: ` plus each allowed value JSON-encoded, joined with `, ` |
| `pattern` | `must match pattern <pattern>` |
| `format` | `must be a valid <format>` |
| `minimum` | `must be >= <n>` |
| `maximum` | `must be <= <n>` |
| `minItems` | `must have at least <n> items` |
| `maxItems` | `must have at most <n> items` |
| `minLength` | `must be at least <n> characters` |
| `maxLength` | `must be at most <n> characters` |
| `propertyNames` | `property name '<name>' is not allowed`. `path` is the pointer of that property, not of the parent object. |

`propertyNames` is reported under keyword `propertyNames` even when the failing assertion inside it is `pattern`.

A present but illegal `X-FakeApi-Now` while `FAKEAPI_CLOCK=manual` is also this 400 shape: keyword `type`, path `""`, message `X-FakeApi-Now must be an integer number of milliseconds.`, top-level message `Request payload is invalid.`

### Clock and idle overrides

| variable | meaning |
| --- | --- |
| `FAKEAPI_CLOCK` | `system` (default) or `manual` |
| `X-FakeApi-Now` | Unix epoch milliseconds. Honored only when `FAKEAPI_CLOCK=manual`. Absent means the system clock for that request. The value matches `^-?(0|[1-9][0-9]*)$` after trimming. |
| `FAKEAPI_MAX_IDLE_MS` | Idle limit in milliseconds. Default `7200000`. Minimum `0`. |
| `FAKEAPI_PURGE_INTERVAL_MS` | Background sweep interval in milliseconds. Default `900000`. Minimum `1`. |

When `FAKEAPI_CLOCK=manual`, the background sweep does not run. Every request purges first, using the injected timestamp (or the system clock when the header is absent), and then handles the request. `last_active` and the injected clock are integer milliseconds. A user is removed when `last_active < now - max_idle`.

### CORS

When the request has an `Origin` header, the response gains:

- `Access-Control-Allow-Origin`: the Origin value, unchanged
- `Access-Control-Allow-Credentials`: `true`
- `Vary`: `Origin` when the response had no `Vary`, otherwise the existing value plus `, Origin` if `Origin` is not already listed

Preflight is `OPTIONS` with both `Origin` and `Access-Control-Request-Method`. It does not require auth, it is not playback, and it wins over a recorded `OPTIONS` route. Status **204**, empty body, no `Content-Type`, no `WWW-Authenticate`, no `Access-Control-Max-Age`. Also:

- `Access-Control-Allow-Methods`: the `Access-Control-Request-Method` value, unchanged
- `Access-Control-Allow-Headers`: the `Access-Control-Request-Headers` value, unchanged, only when that header is present and non-empty. Do not trim or rejoin.

`OPTIONS` without that pair is ordinary playback.

### Reference hooks

The suite names two hooks. Each runner installs them through that server's normal hook configuration.

- `prefix` (string): return `"[" + format + "]" + serialized`. `format` is `json` or `xml`. The serializer's trailing newline stays in place.
- `stamp` (object): return a record whose `msg` is the previous `msg` plus ` [stamped]`, other fields unchanged.

`identity` means the server's default hook. Do not install a hook that changes bytes.

### Duplicate identity

Two recordings collide when all of these match: method (lowercase), path, body (`null` when the property was omitted, which is distinct from `""`), the set of lowercased header pairs, and the set of query pairs. Response status, content, headers, delay, and `response_mode` are not part of the identity. A collision is 409 `Conflict`.
