class Get {
    static getResponse(req, res) {
        if (!res.locals.user) {
            res.unauthorized();
            return;
        }

        let endpoint;

        try {
            endpoint = res.locals.user.findEndpoint(req);
        } catch (err) {
            if (err.plain) {
                res.plain(err.status || 409, 'Conflict');
                return;
            }

            throw err;
        }

        if (endpoint) {
            sendResponse(req, res, endpoint);
            return;
        }

        res.plain(404, 'Not Found');
    }
}

const SKIPPED_RESPONSE_HEADERS = new Set(['content-length', 'transfer-encoding', 'content-type']);

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('../classes/Endpoint')} endpoint
 */
function sendResponse(req, res, endpoint) {
    endpoint.getNextResponse().then((endpointResponse) => {
        const callback = () => {
            Object.keys(endpointResponse.headers || {}).forEach((headerName) => {
                if (SKIPPED_RESPONSE_HEADERS.has(headerName.toLowerCase())) {
                    return;
                }

                res.setHeader(headerName, endpointResponse.headers[headerName]);
            });

            res.statusCode = endpointResponse.status;
            res.setHeader('Content-Type', endpointResponse.content_type);
            res.end(endpointResponse.content);
        };

        const delay = endpointResponse.delay > 0 ? endpointResponse.delay : 0;
        setTimeout(callback, delay);
    });
}

module.exports = Get;
