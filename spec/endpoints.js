/**
 *
 * @type {Object<string, Endpoint>}
 */
const endpoints = {
    bad_hello_world: {
        method: 'get',
        path: '/',
        responses: [
            {
                status: 200,
                content: 'Hello World!',
                content_type: 'text/plain',
            },
        ],
    },

    hello_world: {
        method: 'get',
        path: '/hello-world',
        response_mode: 'incremental',
        responses: [
            {
                status: 200,
                content: 'Hello World!',
                content_type: 'text/plain',
                response_delay: 0,
            },
        ],
    },

    hello_incremental: {
        method: 'get',
        path: '/hello-incremental',
        response_mode: 'incremental',
        responses: [
            {
                status: 200,
                content: 'Hello Bob!',
                content_type: 'text/plain',
                response_delay: 0,
            },
            {
                status: 200,
                content: 'Hello Bill!',
                content_type: 'text/plain',
                response_delay: 0,
            },
        ],
    },

    hello_delayed: {
        method: 'get',
        path: '/hello-delayed',
        response_mode: 'incremental',
        responses: [
            {
                status: 200,
                content: 'Hello delayed!',
                content_type: 'text/plain',
                response_delay: 3000,
            },
        ],
    },

    hello_random: {
        method: 'get',
        path: '/hello-random',
        response_mode: 'random',
        responses: [
            {
                status: 200,
                content: 'Hello A!',
                content_type: 'text/plain',
                response_delay: 0,
            },
            {
                status: 200,
                content: 'Hello B!',
                content_type: 'text/plain',
                response_delay: 0,
            },
            {
                status: 200,
                content: 'Hello C!',
                content_type: 'text/plain',
                response_delay: 0,
            },
            {
                status: 200,
                content: 'Hello D!',
                content_type: 'text/plain',
                response_delay: 0,
            },
            {
                status: 200,
                content: 'Hello E!',
                content_type: 'text/plain',
                response_delay: 0,
            },
        ],
    },
};

module.exports = endpoints;