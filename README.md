# Fake API Server

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/2f323f9700ab4e2eaed48f6e79355d70)](https://app.codacy.com/app/jmather/node-fake-api-server?utm_source=github.com&utm_medium=referral&utm_content=jmather/node-fake-api-server&utm_campaign=Badge_Grade_Dashboard)
[![DeepScan grade](https://deepscan.io/api/teams/2509/projects/5227/branches/40566/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=2509&pid=5227&bid=40566)

This tool allows you to register collections of arbitrary endpoints to mock responses for, allowing you to easily test your code end-to-end.

Pair with the [Fake API Client](https://github.com/jmather/node-fake-api-client) for easy collection registration.

View the [API Documentation](https://documenter.getpostman.com/view/4858910/S1LpZrgg#intro) to get a better idea of how to use the Fake API.

A server instance has been set up at [https://node-fake-api-server.herokuapp.com/](https://node-fake-api-server.herokuapp.com/).

## Schema

We have defined an [Open API Specification](/public/fake-api.openapi.yaml) as well as a detailed [JSON Schema](/public/fake-api-schema.json) of the request payloads.

## Usage

### Run Locally (Private)

```bash
npm install -g node-fake-api-server
fake-api-server
```

### Run Locally (Public)

```bash
npm install -g node-fake-api-server
fake-api-server --public
```

### Run In Code

```javascript
const http = require('http');
const app = require('node-fake-api-server');

const port = Math.floor(Math.random() * 2000) + 3000;

app.set('port', port);

const server = http.createServer(app);
server.listen(port);

server.on('listening', () => {
    // do stuff...
});
```