function numberSetting(name, fallback, minimum) {
    const raw = process.env[name];

    if (raw == null || raw === '') {
        return fallback;
    }

    if (!/^-?(0|[1-9][0-9]*)$/.test(String(raw).trim())) {
        return fallback;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < minimum) {
        return fallback;
    }

    return value;
}

function settings() {
    return {
        manual: String(process.env.FAKEAPI_CLOCK || 'system').toLowerCase() === 'manual',
        maxIdleMs: numberSetting('FAKEAPI_MAX_IDLE_MS', 7200000, 0),
        purgeIntervalMs: numberSetting('FAKEAPI_PURGE_INTERVAL_MS', 900000, 1),
    };
}

/**
 * @param {import('express').Request} req
 * @returns {{now: number}|{error: true}}
 */
function resolveNow(req) {
    const config = settings();

    if (!config.manual) {
        return { now: Date.now() };
    }

    const header = req.headers['x-fakeapi-now'];

    if (header == null || String(header).trim() === '') {
        return { now: Date.now() };
    }

    const trimmed = String(header).trim();

    if (!/^-?(0|[1-9][0-9]*)$/.test(trimmed)) {
        return { error: true };
    }

    return { now: Number(trimmed) };
}

module.exports = {
    settings,
    resolveNow,
};
