// Smoke test for the published Blazor app (TVCS-103). Usage: node smoke.mjs <base-url>
// Prints GitHub annotations (::error::) so failures show on the commit's check run.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const base = (process.argv[2] || 'http://localhost:8080/').replace(/\/?$/, '/');
const here = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + detail}`); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
// "Failed to load resource" console lines are judged from the responses below instead, where the URL is known.
page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push('console: ' + m.text()); });
const bad = [];
page.on('requestfailed', r => bad.push(`${r.failure()?.errorText} ${r.url()}`));
// A deep link like /settings is served by GitHub Pages' 404.html (a copy of index.html), so a 404 on a page
// navigation is expected; a 404 on any file the page loads is a real error.
page.on('response', r => { if (r.status() >= 400) { bad.push(`${r.status()} ${r.url()}`); if (!r.request().isNavigationRequest()) errors.push(`${r.status()} ${r.url()}`); } });

try {
  await page.goto(base);
  // With no saved characters the app opens straight on the creation wizard.
  await page.getByRole('heading', { name: /Your characters|Create a character/ }).first().waitFor({ timeout: 60000 });
  check('App loads', true);
  // Styles and fonts now ship with the app instead of the Tailwind CDN and Google Fonts (TVCS-105).
  const look = await page.evaluate(async () => {
    await document.fonts.ready;
    const flex = document.querySelector('[class~="flex"]');
    return { tailwind: flex ? getComputedStyle(flex).display : 'no .flex element',
             cinzel: [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Cinzel' && f.status === 'loaded'),
             crimson: [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Crimson Pro' && f.status === 'loaded') };
  });
  check('Tailwind styles apply', look.tailwind === 'flex', `.flex element has display ${look.tailwind}`);
  check('Bundled fonts load', look.cinzel && look.crimson, JSON.stringify(look));
  // "Report a problem" (TVCS-106) opens the issue form with the version, page and device filled in.
  const report = await page.locator('.site-foot a', { hasText: 'Report a problem' }).getAttribute('href').catch(() => null);
  check('Report a problem link is filled in', report && /template=problem-report\.yml/.test(report) && /version=1\./.test(report)
    && /[?&]page=/.test(report) && /[?&]device=[^&·]+%C2%B7/.test(report), report || 'no link');
  if (await page.getByRole('link', { name: '+ New character' }).isVisible()) await page.getByRole('link', { name: '+ New character' }).click();

  // Create a character with the built-in sample content, choosing whatever each step needs.
  await page.locator('input.field').first().fill('Smoke Tester');
  await page.locator('input.field').first().press('Tab'); // fields save on change (blur)
  const actions = [];
  let created = false;
  for (let i = 0; i < 60 && !created; i++) {
    const createBtn = page.getByRole('button', { name: 'Create character' });
    if (await createBtn.isVisible() && await createBtn.isEnabled()) { actions.push('create'); await createBtn.click(); created = true; break; }
    const next = page.getByRole('button', { name: 'Next' });
    if (await next.isVisible() && await next.isEnabled()) { actions.push('next'); await next.click(); continue; }
    const box = page.locator('.box').last();
    const choices = box.locator('button.choice:not([disabled])');
    if (await box.locator('.choice.selected').count() === 0 && await choices.count()) { actions.push('choice'); await choices.first().click(); continue; }
    const radios = box.locator('button[role=radio]:not([disabled])');
    if (await radios.count() && await box.locator('button[role=radio][aria-checked=true]').count() === 0) { actions.push('radio'); await radios.first().click(); continue; }
    let filled = false;
    for (const inp of await box.locator('input.field:not([type=number])').all()) { if (!(await inp.inputValue())) { await inp.fill('Common'); await inp.press('Tab'); filled = true; actions.push('text'); } }
    if (filled) continue;
    const skill = box.locator('button.btn-sm:not(.btn-primary):not([disabled])');
    if (await skill.count()) { actions.push('skill'); await skill.first().click(); continue; }
    break;
  }
  const stuck = created ? '' : (await page.locator('.box').last().innerText()).replace(/\s+/g, ' ').slice(0, 300);
  check('A character can be created', created, `stuck after [${actions.join(',')}]: ${stuck}`);
  if (created) {
    await page.waitForURL(/character\//, { timeout: 15000 });
    check('The new character opens on its sheet', (await page.content()).includes('Smoke Tester'));
    await page.goto(base);
    await page.getByRole('heading', { name: 'Your characters' }).waitFor({ timeout: 30000 });
    check('Character list shows the saved character', (await page.content()).includes('Smoke Tester'));
  }

  // Import the sample content file on the Content page, then reload: it must still be there (IndexedDB).
  await page.goto(base + 'settings');
  await page.getByRole('heading', { name: 'Content library' }).waitFor({ timeout: 30000 });
  await page.setInputFiles('#content-import', path.join(here, 'sample-content.json'));
  await page.getByText('Imported 3 entries.').waitFor({ timeout: 15000 }).then(() => check('Content page imports a content file', true), e => check('Content page imports a content file', false, e.message));
  await page.reload();
  await page.getByRole('heading', { name: 'Content library' }).waitFor({ timeout: 30000 });
  const lineages = await page.getByRole('button', { name: /Lineages/ }).first().textContent();
  await page.getByRole('button', { name: /Magic Items/ }).first().click();
  check('Imported content survives a reload', (await page.content()).includes('Smoke Test Charm'), `lineage button reads "${lineages}"`);

  // Install and offline (TVCS-105): manifest and icons load, the service worker takes control, and the app
  // with its saved character still opens with the network switched off.
  const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href').catch(() => null);
  const manifestRes = manifestHref ? await page.request.get(new URL(manifestHref, page.url()).href) : null;
  const manifest = manifestRes && manifestRes.ok() ? await manifestRes.json().catch(() => null) : null;
  check('Web app manifest loads', manifest && manifest.name && manifest.icons?.length >= 2, `href=${manifestHref} status=${manifestRes?.status()}`);
  if (manifest) {
    const icon = await page.request.get(new URL(manifest.icons[0].src, new URL(manifestHref, page.url())).href);
    check('App icon loads', icon.ok(), `status ${icon.status()}`);
  }
  const ready = await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready.then(() => true),
    new Promise(r => setTimeout(() => r(false), 30000))])).catch(() => false);
  check('Service worker installs', ready);
  await page.goto(base);
  await page.getByRole('heading', { name: 'Your characters' }).waitFor({ timeout: 30000 });
  check('Service worker controls the page', await page.evaluate(() => !!navigator.serviceWorker.controller));
  await context.setOffline(true);
  try {
    await page.goto(base);
    await page.getByRole('heading', { name: 'Your characters' }).waitFor({ timeout: 30000 });
    check('App opens offline with its saved character', (await page.content()).includes('Smoke Tester'));
    await page.goto(base + 'settings');
    await page.getByRole('heading', { name: 'Content library' }).waitFor({ timeout: 30000 });
    check('A deep link opens offline', true);
  } catch (e) {
    check('App opens offline with its saved character', false, e.message.split('\n')[0]);
  } finally {
    await context.setOffline(false);
  }
} catch (e) {
  check('Smoke test ran to the end', false, e.message.split('\n')[0]);
  const text = await page.evaluate(() => document.body ? document.body.innerText : '(no body)').catch(() => '(unreadable)');
  console.log(`::error title=Page at failure::${page.url()} :: ${text.replace(/\s+/g, ' ').slice(0, 400)}`);
  if (bad.length) console.log(`::error title=Failed requests::${bad.slice(0, 8).join(' | ')}`);
}
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();

const failed = results.filter(r => !r.ok);
for (const f of failed) console.log(`::error title=Smoke test::${f.name}: ${f.detail}`.replace(/\r?\n/g, ' '));
console.log(`${results.length - failed.length}/${results.length} smoke checks passed`);
process.exit(failed.length ? 1 : 0);
