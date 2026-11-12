const express = require('express');
const path = require('path');
const logger = require('morgan');

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
        next();
    };

    req.on('data', (chunk) => {
        chunks.push(chunk);
    });
    req.on('end', () => finish());
    req.on('error', finish);
}

app.set('logging', true);

app.use(logger('dev', {
    skip: function () { return app.set('logging') !== true; },
}));

app.use(readBody);
app.use(express.static(path.join(__dirname, '../public')));
app.use(user_manager_service);
app.use(response_helpers);
app.use(authorization);

app.all(
    '*',
    /**
     *
     * @param {app.request} req
     * @param {app.response} res
     */
    (req, res) => {
        res.locals.requested_at = Date.now();

        const action = req.headers['x-fakeapi-action'];

        if (!action || (req.method !== 'POST' && req.method !== 'PUT')) {
            get.getResponse(req, res);
            return;
        }

        switch (action) {
            case 'register':
                meta.register(req, res);
                break;
            case 'record':
                meta.record(req, res);
                break;
            default:
                get.getResponse(req, res);
                break;
        }
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
