# Fake API conformance suite v1

Language-agnostic HTTP fixtures for [STANDARD.md](STANDARD.md). A .NET or Node runner can be written from this file alone. The directory is byte-identical in each server repo. Runners live outside it.

`VERSION` is the single line `1` plus a newline. `SHA256SUMS` lists every other file in this directory. The suite is wrong if those disagree with the files.

## What a runner does

1. Resolve this directory (next to the server repo root, named `conformance/`).
2. Verify `SHA256SUMS` and `VERSION` before any scenario. Mismatch is a failure. Do not run scenarios after a checksum failure.
3. Read `fixtures/*.json` in lexicographic filename order. Each file is one scenario. Scenarios do not share a process: start a new server, run the steps, stop the server.
4. For each scenario, start the server on `127.0.0.1` and an ephemeral port with the scenario environment. Wait until that port accepts TCP, up to 30 seconds.
5. Run `steps` in order. A failed step fails the scenario; later steps of that scenario are skipped. Other scenarios still run.
6. Exit 0 only when every scenario passed. Print the scenario id, the step id, and the mismatch text on failure.

The Python runner is `python -m fake_api_server.conformance_runner`. It is not part of this directory. It launches `python -m fake_api_server --port <port>` with `PYTHONUNBUFFERED=1` and drops every inherited `FAKEAPI_*` variable before applying the scenario env. Other runners launch their own server the same way: a real listening process, not an in-process test client.

`{{server}}` is predefined as `python`, `dotnet`, or `node` for the process under test.

## Checksums

`SHA256SUMS` uses the `sha256sum` line format: 64 lowercase hex digits, two spaces, a relative path with `/` separators, no `./` prefix. Paths are sorted. `SHA256SUMS` itself is not listed. A file that exists and is not listed is a failure, and so is a listed file that is missing or whose digest differs. `VERSION` must be the bytes `1\n`.

## Scenario

```json
{
  "id": "matching",
  "title": "human description",
  "standard": ["Matching"],
  "env": {"FAKEAPI_CLOCK": "manual"},
  "xml_log": false,
  "hooks": {"string": "identity", "object": "identity"},
  "steps": []
}
```

- `id` and `title` are strings. `standard` is documentation; runners do not interpret it.
- `env` is a string-to-string map merged onto the server process after `FAKEAPI_*` has been cleared. Values are strings even when they look like numbers (`"7200000"`).
- `xml_log` defaults to false. When true, the runner sets `FAKEAPI_LOG_XML_PATH` to a fresh file and the server appends one `<request-log>` record per completed HTTP request.
- `hooks.string` is `identity` (default) or `prefix`. `hooks.object` is `identity` (default) or `stamp`. See STANDARD.md. The Python runner sets `FAKEAPI_LOG_HOOK=fake_api_server.conformance_hooks:prefix` and `FAKEAPI_LOG_RECORD_HOOK=fake_api_server.conformance_hooks:stamp`. Other runners install the same functions through their own hook configuration. The fixture never names a language-specific symbol.
- When `string` is `prefix`, every JSON log line must start with `[json]` and every XML record line must start with `[xml]`. The runner strips that prefix, then parses. A `{` line while `prefix` is installed is a failure.

The server writes one JSON log line to stdout per completed HTTP request, including 401, 404, 400, 204, and the schema documents. The listening banner and any other non-record stdout are ignored. The runner reads the next record line after each HTTP step (5 second timeout) even when the step does not assert on the log, so lines stay aligned. With `xml_log`, the Nth HTTP step (0-based, sleep steps not counted) is the Nth `<request-log>` line in the file.

## Steps

A step is either sleep or HTTP. `kind` defaults to `http` when `request` is present.

```json
{"kind": "sleep", "ms": 200}
```

Sleep at least `ms` milliseconds. No log line.

```json
{
  "id": "playback",
  "request": {
    "method": "GET",
    "path": "/hello",
    "query": {"who": "foo"},
    "query_raw": "pwd=p%40ss",
    "headers": {"Authorization": "Basic {{auth_token}}"},
    "body": "Foo"
  },
  "expect": {
    "status": 200,
    "elapsed_ms_gte": 250,
    "headers": [],
    "body": {"match": "exact", "value": "Foo"}
  },
  "log": {}
}
```

`query` and `query_raw` are mutually exclusive. `query` is an object of strings or arrays of strings, encoded as `application/x-www-form-urlencoded` with `+` for space, UTF-8, repeated keys in the order written, and object key order preserved. `query_raw` is appended after `?` with no extra encoding. Interpolation runs on path, header values, `query_raw`, string query values, and string bodies.

`body` is omitted or null for no body, a string (UTF-8), `{"repeat": "a", "count": 65636}` (that many copies of the character), or `{"base64": "/w=="}`. The runner does not invent `Content-Type`; the fixture sets it when it matters.

`elapsed_ms_gte` is the client-observed duration of the call. The delay fixture records 300ms and asserts 250, so a coarse timer does not fail a server that slept the full delay.

### Header checks

Names are compared case-insensitively. Only the listed headers are checked. Extra headers (`date`, `content-length`, `server`, …) are allowed unless a check says `absent`.

| match | meaning |
| --- | --- |
| `exact` | value equals `value` after interpolation |
| `prefix` | value starts with `value` |
| `contains` | value contains `value` |
| `present` | header exists |
| `absent` | header does not exist |
| `request_url` | value equals the exact URL the runner called (`http://127.0.0.1:<port><path>` plus `?query` when there was one) |
| `uuid` | value full-matches `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` |
| `regex` | `value` is a Python `re` pattern and must `fullmatch` the header |

### Body checks

| match | meaning |
| --- | --- |
| `exact` | decoded UTF-8 text equals `value` after interpolation. No extra newline. |
| `empty` | zero bytes |
| `file` | raw bytes equal `conformance/<path>` (`assets/fake-api-schema.json`, `assets/fake-api.openapi.yaml`) |
| `regex` | `pattern` `fullmatch`es the decoded text |
| `json` | body parses as JSON and matches `value` (see below) |

### JSON matching

The suite compares JSON as parsed values. Key order and whitespace are not significant. Booleans are not numbers.

- A string, number, boolean, or null must be equal. Strings are interpolated (`{{username}}`, `{{server}}`).
- An array must have the same length; items are compared in order.
- An object with no `match` key is closed: same keys, each value compared. No extra keys.
- An object whose `match` is a string is a matcher:

| match | meaning |
| --- | --- |
| `uuid` | lowercase uuid text, as in the header check |
| `non_empty` | string of length at least 1 |
| `timestamp` | `YYYY-MM-DDTHH:MM:SS.mmmZ` |
| `number` | JSON number (not a boolean). Optional inclusive `minimum` and `maximum`. |
| `basic_token` | standard base64 of `captured(username) + ":" + captured(password)`, UTF-8, with padding. `username` and `password` name earlier captures. |
| `var` | equals the captured string named by `name` |
| `regex` | string `fullmatch` of `pattern` |
| `object` | open object. `keys` are required and compared. `absent` lists keys that must not be present. Other keys are allowed. |

Any matcher may set `capture` to store the actual string for later `{{name}}` interpolation. `uuid` may also set `equals_header` (a response header name) and the value must equal that header. Captures are written only after the matcher succeeds. List `username` and `password` before `auth_token` so the token check can see them. Unknown `{{name}}` is a runner error.

## Log assertion

```json
"log": {
  "raw_prefix": "[json]",
  "raw_excludes": ["{{password}}"],
  "json": {"value": {}},
  "xml": {"text": {"method": "GET", "query/param@name=a#0": "1"}}
}
```

`raw_prefix` and `raw_excludes` look at the stdout line before the `[json]` prefix is stripped, including its trailing newline. Excluded strings are interpolated and must be absent. An empty excluded string is ignored.

`json.value` is a JSON matcher against the parsed object. A closed object locks the field set (capture `none` has exactly the base fields). Use `{"match":"object","keys":{...}}` when only some fields matter.

`xml` requires `xml_log: true`. `text` maps a path to the decoded element text (`null` text is `""`). Paths are relative to `<request-log>` and use `/`:

- `method`, `request/body`, `request/content_type`
- `query/param@name=pwd` selects `<param name="pwd">`
- `#0`, `#1`, … pick one of several matches: `query/param@name=a#1`

The segment grammar is `name`, optional `@attr=value` (value runs until `#`), optional `#index`.

## Scenarios in this version

| file | what it locks |
| --- | --- |
| `01-register-and-auth.json` | credential shape, `Location`, 401 text and realm, bearer playback with `user: null`, basic `user`, 404 text, user isolation |
| `02-actions.json` | only `POST /` + `register` and `PUT /` + `record`; action case preserved in the log |
| `03-validation.json` | the 400 messages and duplicate 409 |
| `04-matching.json` | exact path, header case, raw body score, decoded and repeated query, tie 409 |
| `05-playback.json` | incremental wrap, exact `Content-Type`, response header, full delay, canned 500 logs `error` |
| `06-schema-and-cors.json` | schema bytes, preflight echo, origin reflection |
| `07-idle-clock.json` | manual clock, exact 2 hour boundary, refresh, failed auth does not refresh, bad `X-FakeApi-Now` |
| `08-logging-capture.json` | `capture=all`, raw query values, XML round-trip, 64 KiB truncation |
| `09-logging-headers.json` | `capture=headers` omits bodies |
| `10-logging-hooks.json` | `stamp` then `prefix` on JSON and XML |

Capture `none` is the default and is what scenarios 01, 02, 04, 05, and 10 see unless they set `FAKEAPI_LOG_CAPTURE`.
