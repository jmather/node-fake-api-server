function decodeForm(value) {
    try {
        return decodeURIComponent(String(value).replace(/\+/g, ' '));
    } catch {
        return String(value);
    }
}

function pushValue(map, key, value) {
    if (!Object.hasOwn(map, key)) {
        map[key] = value;
        return;
    }

    if (Array.isArray(map[key])) {
        map[key].push(value);
        return;
    }

    map[key] = [map[key], value];
}

/**
 * Log values stay raw. Match values are decoded, and repeats are joined with a comma.
 *
 * @param {string} urlPath
 * @returns {{log: object, match: object}}
 */
function parseRequestQuery(urlPath) {
    const log = {};
    const decodedLists = {};
    const question = String(urlPath || '').indexOf('?');

    if (question === -1) {
        return { log, match: {} };
    }

    let query = String(urlPath).slice(question + 1);
    const hash = query.indexOf('#');

    if (hash !== -1) {
        query = query.slice(0, hash);
    }

    if (query.length === 0) {
        return { log, match: {} };
    }

    query.split('&').forEach((part) => {
        if (part === '') {
            return;
        }

        const eq = part.indexOf('=');
        const rawKey = eq === -1 ? part : part.slice(0, eq);
        const rawValue = eq === -1 ? '' : part.slice(eq + 1);
        const key = decodeForm(rawKey);

        pushValue(log, key, rawValue);

        if (!Object.hasOwn(decodedLists, key)) {
            decodedLists[key] = [];
        }

        decodedLists[key].push(decodeForm(rawValue));
    });

    const match = {};

    Object.keys(decodedLists).forEach((key) => {
        match[key] = decodedLists[key].join(',');
    });

    return { log, match };
}

module.exports = {
    parseRequestQuery,
};
