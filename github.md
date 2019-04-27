# Fake API
Use the Fake API to mock any remote server interface, allowing you to fully end-to-end test your code.

## Version: 1.0.0

**License:** [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0.html)

### /

#### POST
##### Summary:

Create a new user to `record` endpoints under.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| X-FakeAPI-Action | header |  | Yes |  |

##### Responses

| Code | Description |
| ---- | ----------- |
| 201 | User Created |
| 400 | Request payload is malformed. |

#### PUT
##### Summary:

Record a new endpoint under the user used for authentication.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| X-FakeAPI-Action | header |  | Yes |  |

##### Responses

| Code | Description |
| ---- | ----------- |
| 201 | Endpoint Created |
| 400 | Request payload is malformed. |
| 401 | Unauthorized. |
| 409 | Endpoint has already been recorded. |

##### Security

| Security Schema | Scopes |
| --- | --- |
| BasicAuth | |
| BearerAuth | |
