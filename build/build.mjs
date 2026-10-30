// Builds the static site from the design pages in build/src/*.dc.html.
// Usage: node build/build.mjs   (run from the repository root)
// Output: public/ (index.html, ru/, case-2/, case-3/, ru/case-2/, ru/case-3/; images live in public/img/).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public');
const SRC = path.join(ROOT, 'build', 'src');
// Set SITE_URL (e.g. https://se-abc.pages.dev or your own domain) to emit canonical + hreflang tags.
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

const PAGES = {
  'Main.dc.html':     { out: '',          lang: 'en', pair: 'Main_ru.dc.html',
    desc: 'SEO case study: a new interior-design SaaS site reached the Google top 3 in Germany and 3,133 leads with a $370 link-building budget.' },
  'Main_ru.dc.html':  { out: 'ru/',       lang: 'ru', pair: 'Main.dc.html',
    desc: 'SEO-кейс: новый SaaS-сайт в нише дизайна интерьера вышел в топ-3 Google в Германии и получил 3 133 лида при бюджете на ссылки $370.' },
  'Case2.dc.html':    { out: 'case-2/',    lang: 'en', pair: 'Case2_ru.dc.html',
    desc: 'SEO case study: after losing its domain, an SMS-verification SaaS recaptured 70%+ of its brand traffic and grew non-brand traffic to 15,000+ visits a month.' },
  'Case2_ru.dc.html': { out: 'ru/case-2/', lang: 'ru', pair: 'Case2.dc.html',
    desc: 'SEO-кейс: SaaS в нише SMS-верификации после потери домена перехватил 70%+ брендового трафика и вырастил небрендовый трафик до 15 000+ визитов в месяц.' },
  'Case3.dc.html':    { out: 'case-3/',    lang: 'en', pair: 'Case3_ru.dc.html',
    desc: 'SEO case study: file conversion software tripled Google traffic from 187,000 to 564,000 visits a month with links, programmatic SEO and 14 languages.' },
  'Case3_ru.dc.html': { out: 'ru/case-3/', lang: 'ru', pair: 'Case3.dc.html',
    desc: 'SEO-кейс: софт для конвертации файлов утроил трафик из Google со 187 000 до 564 000 визитов в месяц за счёт ссылок, programmatic SEO и 14 языков.' },
};

const IMAGES = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'images.json'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lookup = (scope, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);

function fill(tpl, scope) {
  return tpl.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, p) => {
    const v = lookup(scope, p);
    if (v === undefined) throw new Error('Unknown hole ' + p);
    return esc(v);
  });
}

function renderVals(src) {
  const m = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  const ctx = vm.createContext({});
  vm.runInContext('class DCLogic { constructor(){ this.props = {}; this.state = {}; } }\n' + m[1] +
    '\nglobalThis.__vals = new Component().renderVals();', ctx);
  return ctx.__vals;
}

function urlFor(file, fromOut) {
  const target = '/' + PAGES[file].out;
  return target;
}

for (const [file, meta] of Object.entries(PAGES)) {
  const src = fs.readFileSync(path.join(SRC, file), 'utf8');
  const vals = renderVals(src);
  const title = src.match(/<title>([\s\S]*?)<\/title>/)[1];
  const helmet = src.match(/<helmet>([\s\S]*?)<\/helmet>/)[1].trim();
  let body = src.match(/<\/helmet>([\s\S]*?)<\/x-dc>/)[1];

  // Expand loops, then plain holes.
  body = body.replace(/<sc-for list="\{\{\s*(\w+)\s*\}\}" as="(\w+)"[^>]*>([\s\S]*?)<\/sc-for>/g,
    (m, list, as, inner) => vals[list].map((item, i) => fill(inner, { ...vals, [as]: item, $index: i })).join(''));
  body = fill(body, vals);

  // Page links and images.
  body = body.replace(/href="(\w+\.dc\.html)"/g, (m, f) => `href="${urlFor(f)}"`);
  body = body.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => {
    if (!IMAGES[id]) throw new Error('No image for ' + id);
    return '/img/' + IMAGES[id];
  });
  body = body.replace(/<img /g, '<img loading="lazy" decoding="async" ');

  const alt = [];
  if (SITE_URL) {
    const self = SITE_URL + '/' + meta.out;
    const pairMeta = PAGES[meta.pair];
    alt.push(`<link rel="canonical" href="${self}">`);
    alt.push(`<link rel="alternate" hreflang="${meta.lang}" href="${self}">`);
    alt.push(`<link rel="alternate" hreflang="${pairMeta.lang}" href="${SITE_URL}/${pairMeta.out}">`);
    alt.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/${meta.lang === 'en' ? meta.out : pairMeta.out}">`);
  }

  const html = `<!doctype html>
<html lang="${meta.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${esc(meta.desc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(meta.desc)}">
<meta name="theme-color" content="#0E1A2B">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${alt.join('\n')}
${helmet}
<style>img{max-width:100%}*,*::before,*::after{box-sizing:border-box}</style>
</head>
<body>${body}</body>
</html>
`;
  const outDir = path.join(OUT, meta.out);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log('built', '/' + meta.out);
}
