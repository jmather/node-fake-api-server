function varyWithOrigin(current) {
    if (current == null || current === '') {
        return 'Origin';
    }

    const parts = String(current).split(',').map((part) => part.trim()).filter((part) => part.length > 0);
    const hasOrigin = parts.some((part) => part.toLowerCase() === 'origin');

    if (hasOrigin) {
        return String(current);
    }

    return String(current) + ', Origin';
}

function applyCors(req, res) {
    const origin = req.headers.origin;

    if (origin == null) {
        return false;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', varyWithOrigin(res.getHeader('Vary')));
    return true;
}

function cors(req, res, next) {
    const origin = req.headers.origin;
    const requestMethod = req.headers['access-control-request-method'];
    const preflight = req.method === 'OPTIONS' && origin != null && requestMethod != null && String(requestMethod) !== '';

    if (preflight) {
        applyCors(req, res);
        res.setHeader('Access-Control-Allow-Methods', requestMethod);

        const requestHeaders = req.headers['access-control-request-headers'];

        if (requestHeaders != null && String(requestHeaders) !== '') {
            res.setHeader('Access-Control-Allow-Headers', requestHeaders);
        }

        res.statusCode = 204;
        res.end();
        return;
    }

    applyCors(req, res);
    next();
}

module.exports = cors;
