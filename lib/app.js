const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
var concat = require('concat-stream');

const user_manager_service = require('./middleware/user-manager-service');
const response_helpers = require('./middleware/response-helpers');
const authorization = require('./middleware/authorization');
const meta = require('./routes/meta');
const get = require('./routes/get');

const app = express();

app.set('logging', true);

app.use(logger('dev', {
    skip: function () { return app.set('logging') !== true; },
}));

app.use(function(req, res, next){
    req.pipe(concat(function(data){
        req.body = data;
        next();
    }));
});
app.use(express.static(path.join(__dirname, 'public')));
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

        if (action === 'record') {
            meta.record(req, res);
        }

        meta.register(req, res);
    }
);

// error handler
// eslint-disable-next-line no-unused-vars
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    // console.error(err);

    res.status(err.status || 500);
    res.json({ errors: [ { message: err.message, data: err.data } ] });
});

module.exports = app;
