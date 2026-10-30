# SEO case studies

Static website with three SEO case studies in English and Russian, hosted on Cloudflare (Workers static assets).

| URL | Page |
| --- | --- |
| `/` · `/ru/` | Case 1: interior-design SaaS, Germany ($370 link budget) |
| `/case-2/` · `/ru/case-2/` | Case 2: SMS-verification SaaS, brand recovery |
| `/case-3/` · `/ru/case-3/` | Case 3: file-conversion software, 3× traffic |

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

The site is deployed as a Worker with static assets (`wrangler.toml` points `[assets]` at `public/`).
Workers Builds: Build command *(empty)* · Deploy command `npx wrangler deploy`.
The Worker name in the Cloudflare dashboard must match `name` in `wrangler.toml` (`se`).
