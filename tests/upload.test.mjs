import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../functions/api/upload.js', import.meta.url), 'utf8');
const { onRequestGet, onRequestPost } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function context(overrides = {}, envOverrides = {}) {
    return {
        request: new Request('https://wedding.example/api/upload', {
            method: 'POST', body: new Uint8Array([1, 2, 3]),
            headers: { Origin: 'https://wedding.example', 'X-Upload-Code': 'guest-secret',
                'Content-Length': '3', 'X-File-Name': 'IMG_1234.HEIC',
                'X-Guest-Name': encodeURIComponent('Zoë'), ...overrides },
        }),
        env: { UPLOAD_CODE: 'guest-secret', WEDDING_UPLOADS: { put: async () => ({}) }, ...envOverrides },
    };
}
test('configuration status reveals no secrets and disables unconfigured uploads', async () => {
    assert.deepEqual(await (await onRequestGet({ env: {} })).json(), { available: false, maxBytes: 94371840 });
    assert.equal((await onRequestPost(context({}, { WEDDING_UPLOADS: null }))).status, 503);
});
test('rejects missing/wrong codes and foreign origins before storage', async () => {
    for (const headers of [{ 'X-Upload-Code': '' }, { 'X-Upload-Code': 'wrong' }, { Origin: 'https://other.example' }]) {
        const result = await onRequestPost(context(headers, { WEDDING_UPLOADS: { put: () => assert.fail('must not store') } }));
        assert.ok([401, 403].includes(result.status));
    }
});
test('rejects unsupported, empty, oversized, malformed uploads', async () => {
    for (const headers of [
        { 'X-File-Name': 'payload.html' }, { 'X-File-Name': 'picture.svg' },
        { 'Content-Length': '0' }, { 'Content-Length': '94371841' },
        { 'Content-Length': 'NaN' }, { 'X-File-Name': '%zz' },
        { 'X-Guest-Name': 'a'.repeat(101) },
    ]) {
        const response = await onRequestPost(context(headers, { WEDDING_UPLOADS: { put: () => assert.fail('must not store') } }));
        assert.ok(response.status >= 400 && response.status < 500);
    }
});
test('streams phone media to unique private keys and preserves guest metadata', async () => {
    const keys = [];
    const env = { WEDDING_UPLOADS: { put: async (key, body, options) => {
        keys.push(key);
        assert.ok(body instanceof ReadableStream);
        assert.deepEqual([...new Uint8Array(await new Response(body).arrayBuffer())], [1, 2, 3]);
        assert.equal(options.httpMetadata.contentType, 'image/heic');
        assert.equal(options.httpMetadata.contentDisposition, 'attachment');
        assert.equal(options.customMetadata.guestName, 'Zoë');
        return {};
    } } };
    for (let i = 0; i < 2; i++) assert.equal((await onRequestPost(context({}, env))).status, 201);
    assert.notEqual(keys[0], keys[1]);
});
test('storage failure never reports success or exposes provider errors', async () => {
    const response = await onRequestPost(context({}, { WEDDING_UPLOADS: { put: async () => { throw Error('secret provider detail'); } } }));
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('secret'));
});
