# SEO case studies

Static website with four SEO case studies in English and Russian, hosted on Cloudflare as a Worker (static assets + contact form API).

| URL | Page |
| --- | --- |
| `/` · `/ru/` | Case 1: interior-design SaaS, Germany ($370 link budget) |
| `/case-2/` · `/ru/case-2/` | Case 2: SMS-verification SaaS, brand recovery |
| `/case-3/` · `/ru/case-3/` | Case 3: file-conversion software, 3× traffic |
| `/case-4/` · `/ru/case-4/` | Case 4: trading platform, 8× non-brand traffic with n8n automation |

## Structure

- `public/`: the website that Cloudflare serves (pre-built, no build step needed).
- `build/src/`: source pages; `build/images.json` maps image ids to files in `public/img/`.
- `build/build.mjs`: regenerates `public/` from the sources.

## Rebuild

```sh
node build/build.mjs
# with canonical + hreflang tags for the live domain:
SITE_URL=https://your-domain.example node build/build.mjs
```

## Cloudflare settings

The site is deployed as the Worker `cv`: `wrangler.toml` points `[assets]` at `public/` and `main` at `src/worker.js`.
Workers Builds: Build command *(empty)* · Deploy command `npx wrangler deploy`.
The Worker name in the Cloudflare dashboard must match `name` in `wrangler.toml` (`cv`).

## Contact form ("Discuss your project")

Every case page has a "Discuss your project" button that opens a modal form
(`public/contact.js`, `public/contact.css`): name and email are required,
the request description is optional. The form posts to the Worker
(`src/worker.js`, route `/api/contact`), which:

1. checks a hidden honeypot field and validates the fields;
2. verifies the reCAPTCHA v3 token with Google (action `contact`, score ≥ `RECAPTCHA_MIN_SCORE`);
3. emails the request to `CONTACT_TO` through Resend, with the visitor's email as reply-to.

The recipient address and all keys live only on the server; none of them appear in the HTML.

### One-time setup

1. **reCAPTCHA v3**: at <https://www.google.com/recaptcha/admin/create> create a site
   (type: score-based / v3) and add the site's domain (e.g. `cv.skomoroxi-28e.workers.dev`
   and any custom domain). You get a *site key* and a *secret key*.
2. **Resend**: sign up at <https://resend.com> with the address that should receive requests
   (`degustati@gmail.com`) and create an API key. Without a verified domain, Resend sends
   from `onboarding@resend.dev` and only to the account's own address, which is enough here.
   To send from your own domain later, verify it in Resend and set `MAIL_FROM`.
3. In Cloudflare: **Workers & Pages → cv → Settings → Variables and Secrets**, add:
   - `RECAPTCHA_SITE_KEY`: Text, the site key
   - `RECAPTCHA_SECRET`: Secret, the secret key
   - `RESEND_API_KEY`: Secret, the Resend API key

   `CONTACT_TO` and `RECAPTCHA_MIN_SCORE` are set in `wrangler.toml`.

Until these are set, the form shows an error instead of sending (it fails closed, so spam can't get through).
