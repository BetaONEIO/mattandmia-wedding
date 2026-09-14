import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../functions/api/upload.js', import.meta.url), 'utf8');
const { onRequestGet, onRequestPost } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function context(overrides = {}, envOverrides = {}) {
    return {
        request: new Request('https://wedding.example/api/upload', {
            method: 'POST', body: new Uint8Array([1, 2, 3]),
            headers: { Origin: 'https://wedding.example',
                'Content-Length': '3', 'X-File-Name': 'IMG_1234.HEIC',
                'X-Guest-Name': encodeURIComponent('Zoë'), ...overrides },
        }),
        env: { WEDDING_UPLOADS: { put: async () => ({}) }, ...envOverrides },
    };
}
test('configuration status reveals no secrets and disables unconfigured uploads', async () => {
    assert.deepEqual(await (await onRequestGet({ env: {} })).json(), { available: false, maxBytes: 94371840 });
    assert.equal((await onRequestPost(context({}, { WEDDING_UPLOADS: null }))).status, 503);
});
test('rejects foreign and missing origins before storage', async () => {
    for (const headers of [{ Origin: '' }, { Origin: 'https://other.example' }]) {
        const result = await onRequestPost(context(headers, { WEDDING_UPLOADS: { put: () => assert.fail('must not store') } }));
        assert.equal(result.status, 403);
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

test('uploads are available and save without a code or secret', async () => {
    const ctx = context();
    assert.equal((await (await onRequestGet(ctx)).json()).available, true);
    assert.equal((await onRequestPost(ctx)).status, 201);
});

const driveEnv = {
    UPLOAD_STORAGE: 'google-drive',
    GOOGLE_DRIVE_FOLDER_ID: 'wedding-folder',
    GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_REFRESH_TOKEN: 'refresh',
    WEDDING_UPLOADS: { put: () => assert.fail('Drive mode must not silently save to R2') },
};
test('Drive mode requires complete configuration and never falls back to R2', async () => {
    const ctx = context({}, { ...driveEnv, GOOGLE_REFRESH_TOKEN: '' });
    assert.equal((await (await onRequestGet(ctx)).json()).available, false);
    assert.equal((await onRequestPost(ctx)).status, 503);
});
test('Drive streams the original into the configured folder without exposing tokens', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) {
            assert.equal(url, 'https://oauth2.googleapis.com/token');
            assert.equal(options.body.get('grant_type'), 'refresh_token');
            return Response.json({ access_token: 'access-secret' });
        }
        if (calls.length === 2) {
            const metadata = JSON.parse(options.body);
            assert.deepEqual(metadata.parents, ['wedding-folder']);
            assert.equal(metadata.name, 'IMG_1234.HEIC');
            assert.equal(metadata.description, 'Wedding guest upload from Zoë');
            return new Response(null, { headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' } });
        }
        assert.equal(options.method, 'PUT');
        assert.ok(options.body instanceof ReadableStream);
        assert.equal(options.headers['Content-Length'], '3');
        assert.deepEqual([...new Uint8Array(await new Response(options.body).arrayBuffer())], [1, 2, 3]);
        return Response.json({ id: 'saved-file' });
    });
    const response = await onRequestPost(context({}, driveEnv));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls.length, 3);
});
test('Drive failures, incomplete transfers and unexpected destinations never report saved', async t => {
    for (const failure of ['token', 'session', 'destination', 'incomplete', 'missing-id']) {
        let calls = 0;
        const mock = t.mock.method(globalThis, 'fetch', async () => {
            calls++;
            if (calls === 1) return failure === 'token' ? new Response('provider secret', { status: 401 }) : Response.json({ access_token: 'token' });
            if (calls === 2) {
                if (failure === 'session') return new Response(null, { status: 403 });
                return new Response(null, { headers: { Location: failure === 'destination' ? 'https://example.org/upload' : 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' } });
            }
            return failure === 'incomplete' ? new Response(null, { status: 308 }) : Response.json({});
        });
        const response = await onRequestPost(context({}, driveEnv));
        assert.equal(response.status, 502);
        assert.ok(!(await response.text()).includes('provider secret'));
        mock.mock.restore();
    }
});
