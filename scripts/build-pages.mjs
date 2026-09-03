import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'portfolio', 'apps.json');
const outputRoot = path.join(root, '_site');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1) ?? 'expo-template';
const configuredBasePath = process.env.GITHUB_PAGES_BASE_PATH ?? `/${repositoryName}`;
const basePath = configuredBasePath === '/' ? '' : configuredBasePath.replace(/\/$/, '');

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const appUrl = (slug) => `${basePath}/${slug}/`;

function validateManifest() {
  if (!manifest.title || !manifest.description || !Array.isArray(manifest.apps)) {
    throw new Error('portfolio/apps.json must contain title, description, and an apps array');
  }

  const slugs = new Set();
  for (const app of manifest.apps) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app.slug ?? '')) {
      throw new Error(`Invalid app slug: ${app.slug}`);
    }
    if (slugs.has(app.slug)) {
      throw new Error(`Duplicate app slug: ${app.slug}`);
    }
    slugs.add(app.slug);

    if (!app.name || !app.description || !app.category || !app.status) {
      throw new Error(`App ${app.slug} is missing required portfolio metadata`);
    }

    if (app.source) {
      const sourceDirectory = path.resolve(root, app.source);
      const relativeSource = path.relative(root, sourceDirectory);
      if (relativeSource.startsWith('..') || path.isAbsolute(relativeSource)) {
        throw new Error(`App ${app.slug} source must stay inside the repository`);
      }
      if (!fs.existsSync(path.join(sourceDirectory, 'package.json'))) {
        throw new Error(`App ${app.slug} source does not contain package.json: ${app.source}`);
      }
    }
  }
}

function pageShell({ title, description, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="description" content="${escapeHtml(description)}" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: Canvas; color: CanvasText; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 64px 0 80px; }
    .eyebrow { margin: 0 0 12px; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.6; }
    h1 { max-width: 780px; margin: 0; font-size: clamp(2.2rem, 7vw, 5rem); line-height: 0.96; letter-spacing: -0.055em; }
    .lede { max-width: 720px; margin: 24px 0 0; font-size: clamp(1rem, 2.5vw, 1.25rem); line-height: 1.65; opacity: 0.72; }
    .summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 28px 0 0; }
    .pill { border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); border-radius: 999px; padding: 8px 12px; font-size: 0.82rem; opacity: 0.78; }
    .section-title { margin: 42px 0 0; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.58; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-top: 14px; }
    .card { min-height: 220px; display: flex; flex-direction: column; justify-content: space-between; gap: 28px; border: 1px solid color-mix(in srgb, CanvasText 14%, transparent); border-radius: 24px; padding: 24px; color: inherit; text-decoration: none; background: color-mix(in srgb, Canvas 96%, CanvasText 4%); transition: transform 150ms ease, border-color 150ms ease; }
    .card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, CanvasText 32%, transparent); }
    .card h2 { margin: 8px 0 8px; font-size: 1.35rem; letter-spacing: -0.025em; }
    .card p { margin: 0; line-height: 1.55; opacity: 0.68; }
    .meta { display: flex; justify-content: space-between; gap: 12px; align-items: center; font-size: 0.78rem; }
    .status { text-transform: capitalize; opacity: 0.62; }
    .cta { font-weight: 700; }
    .roadmap { margin-top: 44px; padding-top: 26px; border-top: 1px solid color-mix(in srgb, CanvasText 14%, transparent); }
    .roadmap-header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 20px; }
    .roadmap-header h2 { margin: 0; font-size: 1.2rem; letter-spacing: -0.02em; }
    .roadmap-header p { margin: 0; max-width: 620px; opacity: 0.62; line-height: 1.5; }
    .roadmap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0 24px; margin-top: 14px; }
    .roadmap-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent); color: inherit; text-decoration: none; }
    .roadmap-item strong { font-size: 0.94rem; }
    .roadmap-item small { display: block; margin-top: 3px; opacity: 0.52; }
    .roadmap-item span:last-child { white-space: nowrap; font-size: 0.76rem; opacity: 0.54; }
    .placeholder { max-width: 720px; margin-top: 48px; padding: 28px; border: 1px solid color-mix(in srgb, CanvasText 14%, transparent); border-radius: 24px; background: color-mix(in srgb, Canvas 96%, CanvasText 4%); }
    .placeholder h2 { margin-top: 0; }
    .back { display: inline-block; margin-top: 24px; color: inherit; font-weight: 700; }
    @media (max-width: 560px) { main { padding-top: 40px; } .card { min-height: 200px; } }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

function renderDashboard() {
  const availableApps = manifest.apps.filter((app) => Boolean(app.source));
  const plannedApps = manifest.apps.filter((app) => !app.source);
  const cards = availableApps
    .map(
      (app) => `<a class="card" href="${escapeHtml(appUrl(app.slug))}">
        <div>
          <div class="eyebrow">${escapeHtml(app.category)}</div>
          <h2>${escapeHtml(app.name)}</h2>
          <p>${escapeHtml(app.description)}</p>
        </div>
        <div class="meta"><span class="status">${escapeHtml(app.status)}</span><span class="cta">Open web app →</span></div>
      </a>`,
    )
    .join('\n');
  const roadmap = plannedApps
    .map(
      (app) => `<a class="roadmap-item" href="${escapeHtml(appUrl(app.slug))}">
        <span><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.category)}</small></span>
        <span>planned →</span>
      </a>`,
    )
    .join('\n');

  return pageShell({
    title: manifest.title,
    description: manifest.description,
    body: `<p class="eyebrow">Expo mobile apps</p>
      <h1>${escapeHtml(manifest.title)}</h1>
      <p class="lede">${escapeHtml(manifest.description)}</p>
      <div class="summary"><span class="pill">${availableApps.length} web preview${availableApps.length === 1 ? '' : 's'}</span><span class="pill">${plannedApps.length} planned</span><span class="pill">one shared foundation</span></div>
      <p class="section-title">Available now</p>
      <section class="grid" aria-label="Available mobile applications">${cards}</section>
      ${
        plannedApps.length
          ? `<section class="roadmap" aria-label="Planned mobile applications">
              <div class="roadmap-header">
                <h2>Roadmap</h2>
                <p>Stable routes remain reserved, but planned apps stay compact until there is a real build to open.</p>
              </div>
              <div class="roadmap-grid">${roadmap}</div>
            </section>`
          : ''
      }`,
  });
}

function renderPlaceholder(app) {
  return pageShell({
    title: `${app.name} · ${manifest.title}`,
    description: app.description,
    body: `<p class="eyebrow">${escapeHtml(app.category)} · ${escapeHtml(app.status)}</p>
      <h1>${escapeHtml(app.name)}</h1>
      <p class="lede">${escapeHtml(app.description)}</p>
      <div class="placeholder">
        <h2>Route reserved</h2>
        <p>This stable URL is ready for the Expo web build. Add the app directory as <code>source</code> in <code>portfolio/apps.json</code>; the Pages workflow will export the app into this route automatically.</p>
      </div>
      <a class="back" href="${escapeHtml(`${basePath}/`)}">← All apps</a>`,
  });
}

function publishApp(app) {
  const targetDirectory = path.join(outputRoot, app.slug);
  fs.mkdirSync(targetDirectory, { recursive: true });

  if (!app.source) {
    fs.writeFileSync(path.join(targetDirectory, 'index.html'), renderPlaceholder(app));
    return;
  }

  const sourceDirectory = path.resolve(root, app.source);
  const result = spawnSync(
    'bun',
    ['expo', 'export', '--platform', 'web', '--output-dir', targetDirectory],
    {
      cwd: sourceDirectory,
      env: {
        ...process.env,
        EXPO_PUBLIC_GITHUB_PAGES_BASE_URL: appUrl(app.slug).replace(/\/$/, ''),
      },
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Expo export failed for ${app.slug} with exit code ${result.status}`);
  }
}

validateManifest();
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, 'index.html'), renderDashboard());
fs.writeFileSync(path.join(outputRoot, '.nojekyll'), '');
fs.copyFileSync(manifestPath, path.join(outputRoot, 'apps.json'));

for (const app of manifest.apps) {
  publishApp(app);
}

console.log(`Built ${manifest.apps.length} portfolio routes in ${outputRoot}`);
