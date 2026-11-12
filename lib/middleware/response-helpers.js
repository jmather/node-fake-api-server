function requestUrl(req) {
    return req.protocol + '://' + req.get('host') + req.originalUrl;
}

module.exports = (req, res, next) => {
    res.plain = (status, payload) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        if (status === 401) {
            res.setHeader('WWW-Authenticate', 'Basic realm="FakeAPI"');
        }

        res.end(payload);
    };

    res.unauthorized = () => {
        res.plain(401, 'Unauthorized');
    };

    res.created = (payload) => {
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Location', requestUrl(req));
        res.end(JSON.stringify(payload));
    };

    res.badRequest = (message, errors) => {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            message,
            errors,
        }));
    };

    next();
};
