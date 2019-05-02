const ContextError = require('../../lib/classes/ContextError');

it('stores context correctly', () => {
    const err = new ContextError('thing went wrong', { foo: 'bar' });
    expect(err.message).toBe('thing went wrong');
    expect(err.data.foo).toBe('bar');
});

it('defines empty context if omitted', () => {
    const err = new ContextError('thing went wrong');
    expect(err.message).toBe('thing went wrong');
    expect(err.data).not.toBe(undefined);
});