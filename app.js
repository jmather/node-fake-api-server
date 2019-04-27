const http = require('http');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');

const response_helpers = require('./middleware/response-helpers');
const authorization = require('./middleware/authorization');
const meta = require('./routes/meta');
const get = require('./routes/get');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));
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

// app.use('/', indexRouter);
// app.use('/users', usersRouter);
//
// // catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    console.error(err);

    res.status(err.status || 500);
    res.json({ errors: [ { message: err.message, data: err.data } ] });
});

module.exports = app;
