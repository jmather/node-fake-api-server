module.exports = (req, res, next) => {
    res.unauthorized = () => {
        res.set('WWW-Authenticate', 'Basic realm=FakseAPI');
        res.sendStatus(401);
    };

    res.created = (payload) => {
        res.set('Content-Type', 'application/json');
        res.status(201);
        res.json(payload);
    };

    res.badRequest = (message, errors) => {
        res.set('Content-Type', 'application/json');
        res.status(400);
        res.json({
            message,
            errors,
        });
    };

    next();
};