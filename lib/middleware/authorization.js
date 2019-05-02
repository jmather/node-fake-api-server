module.exports = (req, res, next) => {
    if (req.headers['authorization']) {
        const auth_pieces = req.headers['authorization'].split(' ');   // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part

        const buf = Buffer.from(auth_pieces[1], 'base64'); // create a buffer and tell it the data coming in is base64
        const plain_auth = buf.toString();        // read it back out as a string
        const user_pieces = plain_auth.split(':');

        const user = res.locals.user_manager.users[user_pieces[0]];

        if (user && user.password === user_pieces[1]) {
            user.last_active = Date.now();
            res.locals.user = user;
        }
    }

    next();
};