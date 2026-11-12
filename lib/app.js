const express = require('express');

const clock = require('./clock');
const cors = require('./cors');
const sendDocument = require('./documents');
const logging = require('./logging');
const user_manager_service = require('./middleware/user-manager-service');
const response_helpers = require('./middleware/response-helpers');
const authorization = require('./middleware/authorization');
const meta = require('./routes/meta');
const get = require('./routes/get');

const app = express();

function readBody(req, res, next) {
    const chunks = [];
    let settled = false;

    const finish = (err) => {
        if (settled) {
            return;
        }

        settled = true;

        if (err) {
            next(err);
            return;
        }

        req.body = Buffer.concat(chunks);
        req.fakeBodyText = new TextDecoder('utf-8', { fatal: false }).decode(req.body);
        next();
    };

    req.on('data', (chunk) => {
        chunks.push(chunk);
    });
    req.on('end', () => finish());
    req.on('error', finish);
}

app.set('logging', true);
app.setRedactionHook = logging.setRedactionHook;
app.setRecordHook = logging.setRecordHook;

logging.install(app);

app.use(readBody);
app.use(user_manager_service);
app.use(response_helpers);
app.use((req, res, next) => {
    const resolved = clock.resolveNow(req);

    if (resolved.error) {
        res.badRequest('Request payload is invalid.', [
            {
                keyword: 'type',
                path: '',
                message: 'X-FakeApi-Now must be an integer number of milliseconds.',
            },
        ]);
        return;
    }

    res.locals.now = resolved.now;

    if (clock.settings().manual) {
        res.locals.user_manager.purge(resolved.now);
    }

    next();
});
app.use(cors);
app.use(sendDocument);
app.use(authorization);

app.all(
    '*',
    /**
     *
     * @param {app.request} req
     * @param {app.response} res
     */
    (req, res) => {
        if (!res.locals.requested_at) {
            res.locals.requested_at = Date.now();
        }

        const action = String(req.headers['x-fakeapi-action'] || '').toLowerCase();

        if (req.method === 'POST' && req.path === '/' && action === 'register') {
            meta.register(req, res);
            return;
        }

        if (req.method === 'PUT' && req.path === '/' && action === 'record') {
            meta.record(req, res);
            return;
        }

        get.getResponse(req, res);
    }
);

// error handler
app.use(function (err, req, res, next) {
    if (res.headersSent) {
        next(err);
        return;
    }

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    // console.error(err);

    res.status(err.status || 500);
    res.json({ errors: [ { message: err.message, data: err.data } ] });
});

module.exports = app;
