// Write-only guest upload endpoint. Storage sharing is described in UPLOADS.md.
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

// Drive is opt-in so the existing R2 collection keeps working during setup.
function storageReady(env) {
    if (!env.UPLOAD_STORAGE || env.UPLOAD_STORAGE === 'r2') return Boolean(env.WEDDING_UPLOADS);
    return env.UPLOAD_STORAGE === 'google-drive' && Boolean(
        env.GOOGLE_DRIVE_FOLDER_ID && env.GOOGLE_CLIENT_ID &&
        env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN
    );
}

async function uploadToDrive(env, body, { name, guest, type, size }) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token: env.GOOGLE_REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
        signal: AbortSignal.timeout(30000),
        redirect: 'manual',
    });
    if (!tokenResponse.ok) throw new Error('Drive authorisation failed: ' + tokenResponse.status);
    const token = await tokenResponse.json();
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Missing Drive token');
    const authorization = `Bearer ${token.access_token}`;
    // Google resumable sessions let the original video stream straight to Drive.
    // Success is reported only after the final PUT confirms the saved file ID.
    const session = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        method: 'POST',
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': type,
            'X-Upload-Content-Length': String(size),
        },
        body: JSON.stringify({
            name,
            parents: [env.GOOGLE_DRIVE_FOLDER_ID],
            mimeType: type,
            description: `Wedding guest upload from ${guest || 'Anonymous'}`,
        }),
        signal: AbortSignal.timeout(30000),
        redirect: 'manual',
    });
    if (!session.ok) throw new Error('Could not start Drive upload: ' + session.status);
    const location = session.headers.get('Location');
    if (!location) throw new Error('Missing Drive upload session');
    const url = new URL(location);
    if (url.origin !== 'https://www.googleapis.com' || url.pathname !== '/upload/drive/v3/files') {
        throw new Error('Unexpected Drive upload destination');
    }
    // Workers ignores a manually assigned Content-Length on an ordinary stream.
    // Preserve streaming while giving Google the exact transfer length.
    const uploadBody = typeof FixedLengthStream === 'function'
        ? body.pipeThrough(new FixedLengthStream(size)) : body;
    const saved = await fetch(url.href, {
        method: 'PUT',
        headers: { Authorization: authorization, 'Content-Type': type, 'Content-Length': String(size) },
        body: uploadBody,
        signal: AbortSignal.timeout(20 * 60 * 1000),
        redirect: 'manual',
    });
    if (!saved.ok || !(await saved.json()).id) throw new Error('Drive did not confirm the saved file: ' + saved.status);
}

export async function onRequestGet({ env }) {
    return json({ available: storageReady(env), maxBytes: MAX_BYTES });
}

export async function onRequestPost({ request, env }) {
    if (!storageReady(env)) {
        return json({ error: 'Uploads aren’t open yet. Please keep your photos and try again later.' }, 503);
    }
    if (request.headers.get('Origin') !== new URL(request.url).origin) {
        return json({ error: 'Please upload from the wedding website.' }, 403);
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
        if (env.UPLOAD_STORAGE === 'google-drive') {
            await uploadToDrive(env, request.body, { name, guest, type, size });
            return json({ ok: true }, 201);
        }
        // Stream the body: videos must never be buffered into Worker memory.
        const object = await env.WEDDING_UPLOADS.put(key, request.body, {
            httpMetadata: { contentType: type, contentDisposition: 'attachment' },
            customMetadata: { originalName: name, guestName: guest || 'Anonymous' },
        });
        if (!object) throw new Error('Storage did not confirm the upload');
        return json({ ok: true }, 201);
    } catch (error) {
        const safeMessage = /^(Drive authorisation failed|Could not start Drive upload|Drive did not confirm the saved file|Missing Drive|Unexpected Drive)/.test(error.message)
            ? error.message : error.name === 'TypeError'
                ? error.message.replace(/https?:\/\/\S+/g, '[URL]') : error.name;
        console.error('Wedding upload failed:', safeMessage);
        return json({ error: 'That file didn’t save. Please try again.' }, 502);
    }
}
