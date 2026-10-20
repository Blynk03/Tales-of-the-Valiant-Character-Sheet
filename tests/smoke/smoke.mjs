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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const bad = [];
page.on('requestfailed', r => bad.push(`${r.failure()?.errorText} ${r.url()}`));
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

try {
  await page.goto(base);
  await page.getByRole('heading', { name: 'Your characters' }).waitFor({ timeout: 60000 });
  check('Character list loads', true);

  // Create a character with the built-in sample content, choosing whatever each step needs.
  await page.getByRole('link', { name: '+ New character' }).click();
  await page.locator('input.field').first().fill('Smoke Tester');
  let created = false;
  for (let i = 0; i < 60 && !created; i++) {
    const createBtn = page.getByRole('button', { name: 'Create character' });
    if (await createBtn.isVisible() && await createBtn.isEnabled()) { await createBtn.click(); created = true; break; }
    const next = page.getByRole('button', { name: 'Next' });
    if (await next.isVisible() && await next.isEnabled()) { await next.click(); continue; }
    const box = page.locator('.box').last();
    const choices = box.locator('button.choice:not([disabled])');
    if (await box.locator('.choice.selected').count() === 0 && await choices.count()) { await choices.first().click(); continue; }
    const empty = box.locator('input.field').filter({ hasNot: page.locator('[value]:not([value=""])') });
    let filled = false;
    for (const inp of await box.locator('input.field').all()) { if (!(await inp.inputValue())) { await inp.fill('Common'); filled = true; } }
    if (filled) continue;
    const skill = box.locator('button.btn-sm:not(.btn-primary):not([disabled])');
    if (await skill.count()) { await skill.first().click(); continue; }
    break;
  }
  check('A character can be created', created, 'the wizard never enabled "Create character"');
  if (created) {
    await page.waitForURL(/character\//, { timeout: 15000 });
    check('The new character opens on its sheet', (await page.content()).includes('Smoke Tester'));
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
