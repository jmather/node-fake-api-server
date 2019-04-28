# Fake API Server

This tool allows you to register collections of arbitrary endpoints to mock responses for, allowing you to easily test your code end-to-end.

Pair with the [Fake API Client](https://github.com/jmather/node-fake-api-client) for easy collection registration.

View the [API Documentation](https://documenter.getpostman.com/view/4858910/S1LpZrgg#intro) to get a better idea of how to use the Fake API.

A server instance has been set up at [https://node-fake-api-server.herokuapp.com/](https://node-fake-api-server.herokuapp.com/).

## Schema

We have defined an [Open API Specification](/public/fake-api.openapi.yaml) as well as a detailed [JSON Schema](/public/fake-api-schema.json) of the request payloads.

## Usage

### Run Locally (Private)

```
npm install
npm start
```

### Run Locally (Public)

```
npm install
npm run public
```