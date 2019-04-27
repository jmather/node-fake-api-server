const MultipleMatchError = require('../models/MultipleMatchError');

class Get {
  static getResponse(req, res) {
    if (! res.locals.user) {
      res.unauthorized();
      return;
    }

    const endpoint = res.locals.user.findEndpoint(req);

    if (endpoint) {
      sendResponse(req, res, endpoint);
      return;
    }

    res.sendStatus(404);
  }
}

/**
 *
 * @param {app.request} req
 * @param {app.response} res
 * @param {Endpoint} endpoint
 */
function sendResponse(req, res, endpoint) {
  const endpointResponse = endpoint.getNextResponse();

  const callback = () => {
    res.set('Content-Type', endpointResponse.content_type);

    for (const hKey in endpointResponse.headers) {
      if (endpointResponse.headers.hasOwnProperty(hKey) === false) {
        continue;
      }

      res.set(hKey, endpointResponse.headers[hKey]);
    }

    res.status(endpointResponse.status);
    res.end(endpointResponse.content);
  };

  // figure out timing for delayed responses...
  let delay = 0;

  if (endpointResponse.response_delay > 0) {
    const requestTime = (Date.now() - res.locals.requested_at);
    const avgRequestOverhead = 8;
    delay = endpointResponse.response_delay - (requestTime + avgRequestOverhead);
  }

  setTimeout(callback, delay > 0 ? delay : 0);
}

module.exports = Get;
