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
                delay: 0,
            },
        ],
    },

    post_hello_world: {
        method: 'post',
        path: '/hello-world',
        response_mode: 'incremental',
        responses: [
            {
                status: 201,
                content: 'Hello World!',
                content_type: 'text/plain',
                delay: 0,
            },
        ],
    },

    put_hello_world: {
        method: 'put',
        path: '/hello-world',
        response_mode: 'incremental',
        responses: [
            {
                status: 201,
                content: 'Hello World!',
                content_type: 'text/plain',
                delay: 0,
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
                delay: 0,
            },
            {
                status: 200,
                content: 'Hello Bill!',
                content_type: 'text/plain',
                delay: 0,
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
                delay: 500,
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
                delay: 0,
            },
            {
                status: 200,
                content: 'Hello B!',
                content_type: 'text/plain',
                delay: 0,
            },
            {
                status: 200,
                content: 'Hello C!',
                content_type: 'text/plain',
                delay: 0,
            },
            {
                status: 200,
                content: 'Hello D!',
                content_type: 'text/plain',
                delay: 0,
            },
            {
                status: 200,
                content: 'Hello E!',
                content_type: 'text/plain',
                delay: 0,
            },
        ],
    },

    hello_foo: {
        method: 'get',
        path: '/hello-world',
        response_mode: 'incremental',
        query_parameters: {
            who: 'foo'
        },
        responses: [
            {
                status: 200,
                content: 'Hello Foo!',
                content_type: 'text/plain',
                delay: 0,
            },
        ],
    },

    hello_foo_other: {
        method: 'get',
        path: '/hello-world',
        response_mode: 'incremental',
        query_parameters: {
            who: 'foo',
            other: 'other',
        },
        responses: [
            {
                status: 200,
                content: 'Hello Other Foo!',
                content_type: 'text/plain',
                delay: 0,
            },
        ],
    },

    hello_bar: {
        method: 'get',
        path: '/hello-world',
        response_mode: 'incremental',
        headers: {
            'x-whom': 'bar',
        },
        responses: [
            {
                status: 200,
                content: 'Hello Bar!',
                content_type: 'text/plain',
                delay: 0,
            },
        ],
    },

    hello_bar_other: {
        method: 'get',
        path: '/hello-world',
        response_mode: 'incremental',
        headers: {
            'x-whom': 'bar',
            'x-other': 'other',
        },
        responses: [
            {
                status: 200,
                content: 'Hello Other Bar!',
                content_type: 'text/plain',
                delay: 0,
            },
        ],
    },
};

module.exports = endpoints;