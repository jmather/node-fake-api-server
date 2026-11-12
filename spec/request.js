/**
 * Small stand-in for the subset of request-promise this suite used to call.
 * Non-2xx responses reject with `statusCode` and `error` (parsed JSON when
 * `json` is set and the body is JSON, otherwise the raw text).
 *
 * @param {object} options
 * @returns {Promise<object|string>}
 */
function request(options) {
    const url = new URL(options.url || options.uri);

    if (options.qs) {
        Object.keys(options.qs).forEach((key) => {
            const value = options.qs[key];

            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });
    }

    const headers = Object.assign({}, options.headers);

    if (options.auth && options.auth.user != null) {
        const token = Buffer.from(options.auth.user + ':' + options.auth.pass, 'latin1').toString('base64');
        headers.authorization = 'Basic ' + token;
    }

    if (!headers.connection && !headers.Connection) {
        headers.connection = 'close';
    }

    let body;

    if (options.body !== undefined) {
        if (options.json && typeof options.body !== 'string') {
            body = JSON.stringify(options.body);

            if (!headers['content-type'] && !headers['Content-Type']) {
                headers['content-type'] = 'application/json';
            }
        } else {
            body = options.body;
        }
    }

    return fetch(url, {
        method: options.method || 'GET',
        headers,
        body,
    }).then(async (response) => {
        const text = await response.text();
        const headersObj = {};

        response.headers.forEach((value, key) => {
            headersObj[key] = value;
        });

        let parsed = text;

        if (options.json && text) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = text;
            }
        }

        if (response.status < 200 || response.status >= 300) {
            const error = new Error('Status code ' + response.status);
            error.statusCode = response.status;
            error.error = parsed;
            throw error;
        }

        if (options.resolveWithFullResponse) {
            return {
                statusCode: response.status,
                body: parsed,
                headers: headersObj,
            };
        }

        return parsed;
    });
}

/**
 * Run `iterator` over `items` in order, like Bluebird's Promise.each.
 *
 * @param {Array} items
 * @param {Function} iterator
 * @returns {Promise<void>}
 */
function each(items, iterator) {
    let chain = Promise.resolve();

    items.forEach((item) => {
        chain = chain.then(() => iterator(item));
    });

    return chain;
}

module.exports = request;
module.exports.each = each;
