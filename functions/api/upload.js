// Private, write-only guest uploads. See UPLOADS.md for Cloudflare setup.
const MAX_BYTES = 90 * 1024 * 1024;
const TYPES = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
    webm: 'video/webm', '3gp': 'video/3gpp',
};
const json = (body, status = 200) => Response.json(body, {
    status, headers: { 'Cache-Control': 'no-store' },
});

export async function onRequestGet({ env }) {
    return json({ available: Boolean(env.WEDDING_UPLOADS && env.UPLOAD_CODE), maxBytes: MAX_BYTES });
}

export async function onRequestPost({ request, env }) {
    if (!env.WEDDING_UPLOADS || !env.UPLOAD_CODE) {
        return json({ error: 'Uploads aren’t open yet. Please keep your photos and try again later.' }, 503);
    }
    if (request.headers.get('Origin') !== new URL(request.url).origin) {
        return json({ error: 'Please upload from the wedding website.' }, 403);
    }
    const code = request.headers.get('X-Upload-Code') || '';
    if (code !== env.UPLOAD_CODE) {
        return json({ error: 'That upload code doesn’t look right. Please check with Matt & Mia.' }, 401);
    }
    const size = Number(request.headers.get('Content-Length'));
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES || !request.body) {
        return json({ error: 'Choose a non-empty photo or video under 90 MB.' }, 413);
    }
    let name, guest;
    try {
        name = decodeURIComponent(request.headers.get('X-File-Name') || '');
        guest = decodeURIComponent(request.headers.get('X-Guest-Name') || '').trim();
    } catch {
        return json({ error: 'Please choose your files again.' }, 400);
    }
    if (!name || name.length > 255 || guest.length > 100) {
        return json({ error: 'Please use a shorter file name or guest name.' }, 400);
    }
    const extension = name.split('.').pop().toLowerCase();
    const type = TYPES[extension];
    if (!type) return json({ error: 'Please choose a supported photo or video file.' }, 415);
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150);
    const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
    try {
        // Stream the body: videos must never be buffered into Worker memory.
        const object = await env.WEDDING_UPLOADS.put(key, request.body, {
            httpMetadata: { contentType: type, contentDisposition: 'attachment' },
            customMetadata: { originalName: name, guestName: guest || 'Anonymous' },
        });
        if (!object) throw new Error('Storage did not confirm the upload');
        return json({ ok: true }, 201);
    } catch {
        return json({ error: 'That file didn’t save. Please try again.' }, 502);
    }
}
