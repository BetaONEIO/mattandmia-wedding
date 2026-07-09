// Cloudflare Pages Function — receives RSVP form submissions and relays
// them as an email via Brevo's transactional email API, so we don't depend
// on FormSubmit (which has had intermittent 522s).
//
// Requires these Pages project environment variables (Settings ->
// Environment variables), set for both Production and Preview:
//   BREVO_API_KEY   secret  — Brevo API key (Settings -> SMTP & API -> API Keys)
//   RSVP_TO_EMAIL    plain  — where RSVPs should land (forwarded to Mia from here)

const SENDER_EMAIL = 'admin@betaone.io'; // verified sender in Brevo

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export async function onRequestPost({ request, env }) {
    const missing = ['BREVO_API_KEY', 'RSVP_TO_EMAIL'].filter((k) => !env[k]);
    if (missing.length) {
        return new Response(`RSVP is not configured (missing ${missing.join(', ')})`, { status: 500 });
    }

    const formData = await request.formData();

    // Honeypot — bots fill every field, real users never see this one.
    if (formData.get('_honey')) {
        return new Response(null, { status: 204 });
    }

    const subject = formData.get('_subject') || 'Wedding RSVP';
    const fields = [...formData.entries()].filter(([key]) => !key.startsWith('_'));

    const rows = fields
        .map(([key, value]) => {
            const label = escapeHtml(key).replace(/_/g, ' ');
            const text = escapeHtml(String(value)).replace(/\n/g, '<br>');
            return `<tr><td style="padding:4px 10px;font-weight:bold;vertical-align:top;">${label}</td><td style="padding:4px 10px;">${text}</td></tr>`;
        })
        .join('');

    const replyToEmail = formData.get('email');
    const replyToName = formData.get('name');

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            sender: { email: SENDER_EMAIL, name: 'Wedding RSVP' },
            to: [{ email: env.RSVP_TO_EMAIL }],
            ...(replyToEmail ? { replyTo: { email: replyToEmail, name: replyToName || undefined } } : {}),
            subject,
            htmlContent: `<table>${rows}</table>`,
        }),
    });

    if (!brevoRes.ok) {
        const detail = await brevoRes.text().catch(() => '');
        return new Response(`Failed to send RSVP: ${detail}`, { status: 502 });
    }

    const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
    if (wantsJson) {
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const referer = request.headers.get('Referer') || '/';
    return Response.redirect(referer.split('#')[0] + '#rsvp', 303);
}
