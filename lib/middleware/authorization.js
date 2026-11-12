function decodeToken(token) {
    if (typeof token !== 'string' || token.length === 0) {
        return null;
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(token) || token.length % 4 !== 0) {
        return null;
    }

    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const splitAt = decoded.indexOf(':');

    if (splitAt === -1) {
        return null;
    }

    return {
        username: decoded.slice(0, splitAt),
        password: decoded.slice(splitAt + 1),
    };
}

function credentials(header) {
    if (!header || typeof header !== 'string') {
        return null;
    }

    const match = header.match(/^(\S+)\s+(\S+)\s*$/);

    if (!match) {
        return null;
    }

    const scheme = match[1].toLowerCase();

    if (scheme !== 'basic' && scheme !== 'bearer') {
        return { scheme, credentials: null };
    }

    return {
        scheme,
        credentials: decodeToken(match[2]),
    };
}

module.exports = (req, res, next) => {
    const parsed = credentials(req.headers.authorization);

    if (parsed && parsed.credentials) {
        const user = res.locals.user_manager.users[parsed.credentials.username];

        if (user && user.password === parsed.credentials.password) {
            user.last_active = res.locals.now == null ? Date.now() : res.locals.now;
            res.locals.user = user;
        }
    }

    next();
};

module.exports.credentials = credentials;
