const TestHelper = require('./helper');
const helper = new TestHelper();

describe('TestHelper', () => {
    it('rebinds when you try to connect to port 80', () => {
        expect.assertions(1);
        return helper.buildServer(443).then((client) => {
            const uri = new URL(client.server);
            expect(uri.port).not.toBe('443');
            helper.stopServer();
        });
    });

    it('rebinds when you try to connect to a port that is already used', () => {
        expect.assertions(1);
        return helper.buildServer().then((client1) => {
            const server1 = helper.server;
            const uri = new URL(client1.server);
            return helper.buildServer(uri.port).then((client2) => {
                const otherUri = new URL(client2.server);

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
});
