const url = require('url');
const helper = require('./test-helper');

it('rebinds when you try to connect to port 80', () => {
    expect.assertions(1);
    return helper.buildServer(80).then((client) => {
        const uri = url.parse(client.server);
        expect(uri.port).not.toBe(80);
        helper.stopServer();
    });
});

it('rebinds when you try to connect to a port that is already used', () => {
    expect.assertions(1);
    return helper.buildServer().then((client1) => {
        const server1 = helper.server;
        const uri = url.parse(client1.server);
        return helper.buildServer(uri.port).then((client2) => {
            const otherUri = url.parse(client2.server);

            expect(otherUri.port).not.toBe(uri.port);
            server1.close();
            helper.stopServer();
        });
    });
});

it('blows up completely on a random error', () => {
    expect.assertions(1);

    const oldStartListening = helper.startListening;

    helper.startListening = (port) => { helper.server.listen(port, 'sdkfjhsd.sdflkjsah'); };

    return helper.buildServer().catch(error => {
        expect(error.toString()).toBe('Error: getaddrinfo ENOTFOUND sdkfjhsd.sdflkjsah');

        helper.startListening = oldStartListening;
    });
});