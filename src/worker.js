// Cloudflare Worker: serves the static site from public/ and handles the contact form.
//
//   GET  /api/config   -> { siteKey } (the public reCAPTCHA v3 site key)
//   POST /api/contact  -> verifies reCAPTCHA v3, validates the fields, emails the request via Resend
//
// Configuration (Cloudflare dashboard → Worker → Settings → Variables and Secrets):
//   RECAPTCHA_SITE_KEY   text    public site key from the reCAPTCHA admin console (v3)
//   RECAPTCHA_SECRET     secret  secret key from the same reCAPTCHA site
//   RESEND_API_KEY       secret  API key from resend.com
//   CONTACT_TO           text    where requests are delivered (set in wrangler.toml)
//   MAIL_FROM            text    optional sender, default "SEO case studies <onboarding@resend.dev>"
//   RECAPTCHA_MIN_SCORE  text    optional, default 0.5

const MAX = { name: 100, email: 254, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function verifyRecaptcha(token, ip, env) {
  if (!env.RECAPTCHA_SECRET) return { ok: false, reason: 'not-configured' };
  if (!token) return { ok: false, reason: 'missing-token' };
  const body = new URLSearchParams({ secret: env.RECAPTCHA_SECRET, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body });
  if (!res.ok) return { ok: false, reason: 'verify-http-' + res.status };
  const data = await res.json();
  const min = Number(env.RECAPTCHA_MIN_SCORE || 0.5);
  if (!data.success) return { ok: false, reason: 'invalid-token' };
  if (data.action !== 'contact') return { ok: false, reason: 'wrong-action' };
  if (typeof data.score !== 'number' || data.score < min) return { ok: false, reason: 'low-score', score: data.score };
  return { ok: true, score: data.score };
}

async function sendEmail(env, { name, email, message, page, lang }) {
  if (!env.RESEND_API_KEY || !env.CONTACT_TO) throw new Error('email-not-configured');
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Page: ${page || '-'}`,
    `Language: ${lang || '-'}`,
    '',
    message || '(no description)',
  ].join('\n');
  const html = `<h2 style="font-family:sans-serif">New project request</h2>
<table style="font-family:sans-serif;font-size:15px;border-collapse:collapse">
<tr><td style="padding:4px 12px 4px 0;color:#555">Name</td><td>${escapeHtml(name)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Email</td><td>${escapeHtml(email)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Page</td><td>${escapeHtml(page || '-')}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Language</td><td>${escapeHtml(lang || '-')}</td></tr>
</table>
<p style="font-family:sans-serif;font-size:15px;white-space:pre-wrap">${escapeHtml(message || '(no description)')}</p>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'SEO case studies <onboarding@resend.dev>',
      to: [env.CONTACT_TO],
      reply_to: email,
      subject: `New project request from ${name}`.slice(0, 150),
      text,
      html,
    }),
  });
  if (!res.ok) throw new Error('resend-http-' + res.status + ' ' + (await res.text()).slice(0, 300));
}

async function handleContact(request, env) {
  let data;
  try {
    const type = request.headers.get('content-type') || '';
    data = type.includes('application/json')
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return json({ ok: false, error: 'bad-request' }, 400);
  }

  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim();
  const message = String(data.message || '').trim();
  const page = String(data.page || '').slice(0, 300);
  const lang = String(data.lang || '').slice(0, 5);

  // Honeypot: real visitors never fill this hidden field.
  if (data.website) return json({ ok: true });

  const fields = {};
  if (!name) fields.name = 'required';
  else if (name.length > MAX.name) fields.name = 'too-long';
  if (!email) fields.email = 'required';
  else if (email.length > MAX.email || !EMAIL_RE.test(email)) fields.email = 'invalid';
  if (message.length > MAX.message) fields.message = 'too-long';
  if (Object.keys(fields).length) return json({ ok: false, error: 'validation', fields }, 400);

  const captcha = await verifyRecaptcha(data.token, request.headers.get('cf-connecting-ip'), env);
  if (!captcha.ok) {
    console.warn('reCAPTCHA rejected:', JSON.stringify(captcha));
    return json({ ok: false, error: 'captcha' }, captcha.reason === 'not-configured' ? 503 : 403);
  }

  try {
    await sendEmail(env, { name, email, message, page, lang });
  } catch (err) {
    console.error('Email failed:', err.message);
    return json({ ok: false, error: 'send-failed' }, 502);
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/config') {
      return json({ siteKey: env.RECAPTCHA_SITE_KEY || '' });
    }
    if (pathname === '/api/contact') {
      if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405);
      return handleContact(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
