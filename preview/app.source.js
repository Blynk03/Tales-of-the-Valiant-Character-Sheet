/* Valiant Sheet — browser preview of the Blazor prototype. Same data shapes (camelCase JSON),
   so characters and content exported here import into the Blazor app. */
(function () {
'use strict';
const SEED = window.__SEED__;
let pointerDown = false, pendingRender = false;
const ABIL = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABN = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
const SKILLS = [['Athletics','STR'],['Acrobatics','DEX'],['Sleight of Hand','DEX'],['Stealth','DEX'],['Arcana','INT'],['History','INT'],['Investigation','INT'],['Nature','INT'],['Religion','INT'],['Animal Handling','WIS'],['Insight','WIS'],['Medicine','WIS'],['Perception','WIS'],['Survival','WIS'],['Deception','CHA'],['Intimidation','CHA'],['Performance','CHA'],['Persuasion','CHA']];
const XP = [0,0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
const STD = [15,14,13,12,10,8];
const MAX_LUCK = 5;
const KINDS = [['lineages','Lineages','Lineage'],['heritages','Heritages','Heritage'],['backgrounds','Backgrounds','Background'],['classes','Classes','Class'],['subclasses','Subclasses','Subclass'],['talents','Talents','Talent'],['spells','Spells','Spell'],['items','Items','Item']];
const DEFAULT_ACTIONS = 'Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object';

// ---------- helpers ----------
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const mod = s => Math.floor((s - 10) / 2);
const sg = v => (v >= 0 ? '+' + v : '' + v);
const profFor = l => 2 + Math.floor((Math.min(Math.max(l, 1), 20) - 1) / 4);
const circ = c => c === 0 ? 'Cantrip' : c === 1 ? '1st' : c === 2 ? '2nd' : c === 3 ? '3rd' : c + 'th';
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const die = n => 1 + Math.floor(Math.random() * n);
const hitAvg = d => Math.floor(d / 2) + 1;
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: keep in memory */ } }
};

// ---------- derived values (mirror of Models/Rules.cs) ----------
const M = (c, a) => mod(c.scores[ABIL.indexOf(a)]);
const P = c => profFor(c.level);
const saveB = (c, a) => M(c, a) + (c.saveProficiencies[ABIL.indexOf(a)] ? P(c) : 0);
const skP = (c, s) => c.skills[s] || 'None';
const skMult = p => p === 'Expertise' ? 2 : p === 'Proficient' ? 1 : 0;
const skB = (c, s) => M(c, SKILLS.find(x => x[0] === s)[1]) + P(c) * skMult(skP(c, s));
const passive = (c, s) => 10 + skB(c, s);
const initB = c => M(c, 'DEX') + (c.initiativeBonus || 0);
const wornArmor = c => c.armor.find(a => a.equipped && !a.isShield);
const wornShield = c => c.armor.find(a => a.equipped && a.isShield);
function ac(c, withShield) {
  const dex = M(c, 'DEX'), a = wornArmor(c);
  let v = !a ? 10 + dex : a.baseAC + (a.magicBonus || 0) + (a.category === 'Heavy' ? 0 : a.category === 'Medium' ? Math.min(dex, 2) : dex);
  if (withShield) { const s = wornShield(c) || c.armor.find(x => x.isShield); v += s ? s.baseAC + (s.magicBonus || 0) : 2; }
  return v;
}
const atkAb = (c, w) => w.abilityOverride || (w.finesse ? (M(c, 'DEX') > M(c, 'STR') ? 'DEX' : 'STR') : w.ranged ? 'DEX' : 'STR');
const atkB = (c, w) => M(c, atkAb(c, w)) + (w.proficient ? P(c) : 0) + (w.magicBonus || 0);
const dmgMod = (c, w) => M(c, atkAb(c, w)) + (w.magicBonus || 0);
const dmgExpr = (c, w) => { const m = dmgMod(c, w); return m === 0 ? w.damage : w.damage + sg(m); };
const spellDC = c => c.spellAbility ? 8 + P(c) + M(c, c.spellAbility) : 0;
const spellAtk = c => c.spellAbility ? P(c) + M(c, c.spellAbility) : 0;
const attuned = c => c.magicItems.filter(m => m.attuned).length;

// ---------- content ----------
const emptyLib = () => ({ lineages: [], heritages: [], backgrounds: [], classes: [], subclasses: [], talents: [], spells: [], items: [] });
function lib(kind) {
  const user = S.user[kind] || [], ids = new Set(user.map(u => u.id));
  return SEED[kind].filter(x => !ids.has(x.id)).concat(user).filter(e => !S.disabled.includes(e.source)).sort((a, b) => a.name.localeCompare(b.name));
}
const find = (kind, id) => lib(kind).find(x => x.id === id);
function allEntries(kind) {
  const user = S.user[kind] || [], uids = new Set(user.map(u => u.id)), cids = new Set(SEED[kind].map(c => c.id));
  return SEED[kind].filter(c => !uids.has(c.id)).map(e => ({ e, user: false, over: false }))
    .concat(user.map(e => ({ e, user: true, over: cids.has(e.id) }))).sort((a, b) => a.e.name.localeCompare(b.e.name));
}
function allSources() {
  const set = new Set();
  KINDS.forEach(([k]) => SEED[k].concat(S.user[k] || []).forEach(e => e.source && set.add(e.source)));
  return [...set].sort();
}

// ---------- builder (mirror of Services/CharacterBuilder.cs) ----------
function newChar() {
  return { id: uid(), updated: new Date().toISOString(), name: '', playerName: '', level: 1, experience: 0,
    lineageId: '', lineageName: '', heritageId: '', heritageName: '', backgroundId: '', backgroundName: '', classId: '', className: '', subclassId: '', subclassName: '',
    scores: [10,10,10,10,10,10], saveProficiencies: [false,false,false,false,false,false], skills: {}, luck: 0,
    speed: '30 ft.', initiativeBonus: 0, maxHp: 0, currentHp: 0, tempHp: 0, hitDie: 8, hitDiceUsed: 0, deathSuccesses: 0, deathFailures: 0, exhaustion: 0, conditions: '',
    lightArmor: false, mediumArmor: false, heavyArmor: false, shields: false, simpleWeapons: false, martialWeapons: false, languages: '', otherProficiencies: '',
    talents: [], features: [], actionsRef: DEFAULT_ACTIONS, bonusActionsRef: 'Offhand attack (light weapon), class features', reactionsRef: 'Opportunity Attack, readied action',
    weapons: [], armor: [], gear: [], coins: { pp: 0, gp: 0, sp: 0, cp: 0 }, treasure: '',
    magicItems: [], attunementSlots: 3, mounts: [], vehicles: [], baseName: '', facilities: '', personnel: '', baseNotes: '',
    portraitUrl: '', age: '', height: '', weight: '', eyes: '', skin: '', hair: '', appearanceNotes: '', personality: '', backstory: '', homeland: '', motivation: '', allies: '', otherNotes: '',
    spellcasterClass: '', spellAbility: null, slotsTotal: [0,0,0,0,0,0,0,0,0], slotsExpended: [0,0,0,0,0,0,0,0,0], spells: [], rituals: [] };
}
const toFeature = (f, source, level) => ({ name: f.name, level: level ?? f.level, source, description: f.description, usesMax: f.usesMax || 0, usesSpent: 0, recharge: f.recharge || '' });
const addTalent = (c, t) => c.talents.push({ name: t.name, category: t.category, description: t.description });
function addItem(c, i) {
  if (i.type === 'Weapon') c.weapons.push({ name: i.name, damage: i.damage || '1d4', damageType: i.damageType, range: i.range, properties: i.properties, options: '', finesse: !!i.finesse, ranged: !!i.ranged, proficient: i.weaponCategory === 'Martial' ? c.martialWeapons : c.simpleWeapons, magicBonus: 0, abilityOverride: null });
  else if (i.type === 'Armor') c.armor.push({ name: i.name, baseAC: i.baseAC, category: i.armorCategory, isShield: false, properties: i.properties, magicBonus: 0, equipped: !wornArmor(c) });
  else if (i.type === 'Shield') c.armor.push({ name: i.name, baseAC: i.baseAC || 2, category: 'None', isShield: true, properties: i.properties, magicBonus: 0, equipped: !wornShield(c) });
  else { const g = c.gear.find(x => x.name === i.name); if (g) g.quantity++; else c.gear.push({ name: i.name, quantity: 1, notes: '' }); }
}
function applySlots(c, slots) { if (!slots || !slots.length) return; for (let i = 0; i < 9; i++) c.slotsTotal[i] = slots[i] || 0; }
function finalScore(w, a) { const i = ABIL.indexOf(a); let s = w.base[i]; if (w.plus2 === a) s += 2; if (w.plus1 === a) s += 1; return Math.min(20, s); }
function buildCharacter(w) {
  const c = newChar(); const other = [];
  c.name = (w.name || '').trim() || 'Unnamed Hero'; c.playerName = w.playerName || '';
  ABIL.forEach((a, i) => c.scores[i] = finalScore(w, a));
  const lin = find('lineages', w.lineage), her = find('heritages', w.heritage), bg = find('backgrounds', w.background), cls = find('classes', w.cls);
  if (lin) { c.lineageId = lin.id; c.lineageName = lin.name; c.speed = lin.speed + ' ft.'; other.push('Size: ' + lin.size); lin.traits.forEach(t => c.features.push(toFeature(t, lin.name))); }
  if (her) { c.heritageId = her.id; c.heritageName = her.name; c.languages = her.languages; her.traits.forEach(t => c.features.push(toFeature(t, her.name))); }
  if (bg) {
    c.backgroundId = bg.id; c.backgroundName = bg.name;
    bg.skillProficiencies.forEach(s => c.skills[s] = 'Proficient');
    if (bg.toolProficiencies) other.push(bg.toolProficiencies);
    bg.traits.forEach(t => c.features.push(toFeature(t, bg.name)));
    (bg.equipment || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean).forEach(n => c.gear.push({ name: n, quantity: 1, notes: '' }));
    const t = find('talents', bg.talentId); if (t) addTalent(c, t);
  }
  if (cls) {
    c.classId = cls.id; c.className = cls.name; c.hitDie = cls.hitDie;
    cls.savingThrows.forEach(a => c.saveProficiencies[ABIL.indexOf(a)] = true);
    const ap = cls.armorProficiencies, wp = cls.weaponProficiencies;
    c.lightArmor = ap.includes('Light'); c.mediumArmor = ap.includes('Medium'); c.heavyArmor = ap.includes('Heavy'); c.shields = ap.includes('Shields');
    c.simpleWeapons = wp.includes('Simple'); c.martialWeapons = wp.includes('Martial');
    if (cls.otherProficiencies) other.push(cls.otherProficiencies);
    w.skills.forEach(s => c.skills[s] = 'Proficient');
    if (cls.spellcastingAbility) { c.spellAbility = cls.spellcastingAbility; c.spellcasterClass = cls.name; }
    const l1 = cls.levels.find(l => l.level === 1);
    if (l1) { l1.features.forEach(f => c.features.push(toFeature(f, cls.name, 1))); applySlots(c, l1.spellSlots); }
    c.maxHp = Math.max(1, cls.hitDie + M(c, 'CON')); c.currentHp = c.maxHp;
    if (w.gold) c.coins.gp += cls.startingGold; else w.items.forEach(id => { const i = find('items', id); if (i) addItem(c, i); });
  }
  const t = find('talents', w.talent); if (t && !c.talents.some(x => x.name === t.name)) addTalent(c, t);
  c.otherProficiencies = other.join('; ');
  return c;
}
const levelDef = (cls, n) => cls && cls.levels.find(l => l.level === n);
const needsSub = (c, cls, n) => !!cls && !c.subclassId && n >= cls.subclassLevel;
function gained(c, cls, chosenSub, n) {
  const out = []; const d = levelDef(cls, n);
  if (d) d.features.forEach(f => out.push(toFeature(f, cls.name, n)));
  const cur = find('subclasses', c.subclassId);
  if (cur) cur.features.filter(f => f.level === n).forEach(f => out.push(toFeature(f, cur.name)));
  else if (chosenSub) chosenSub.features.filter(f => f.level <= n).forEach(f => out.push(toFeature(f, chosenSub.name)));
  return out;
}
const hpGain = (c, lu) => Math.max(1, (lu.roll && lu.rolled != null ? lu.rolled : hitAvg(c.hitDie)) + M(c, 'CON'));
function applyLevelUp(c, lu) {
  const cls = find('classes', c.classId), n = c.level + 1, d = levelDef(cls, n);
  const sub = lu.sub ? find('subclasses', lu.sub) : null;
  const gain = hpGain(c, lu);
  if (d && d.grantsAbilityIncrease) {
    const raise = (a, v) => { const i = ABIL.indexOf(a); c.scores[i] = Math.min(20, c.scores[i] + v); };
    if (lu.mode === 'two' && lu.a) raise(lu.a, 2); else { if (lu.a) raise(lu.a, 1); if (lu.b) raise(lu.b, 1); }
  }
  const feats = gained(c, cls, needsSub(c, cls, n) ? sub : null, n);
  c.level = n; c.maxHp += gain; c.currentHp += gain; c.features.push(...feats);
  if (sub && !c.subclassId) { c.subclassId = sub.id; c.subclassName = sub.name; }
  if (d && d.grantsTalent && lu.talent) { const t = find('talents', lu.talent); if (t) addTalent(c, t); }
  if (d) applySlots(c, d.spellSlots);
  if (c.experience < XP[Math.min(n, 20)]) c.experience = XP[Math.min(n, 20)];
}
function takeDamage(c, n) { if (n <= 0) return; const t = Math.min(c.tempHp, n); c.tempHp -= t; c.currentHp = Math.max(0, c.currentHp - (n - t)); }
function heal(c, n) { if (n <= 0) return; if (c.currentHp === 0) { c.deathSuccesses = 0; c.deathFailures = 0; } c.currentHp = Math.min(c.maxHp, c.currentHp + n); }

// ---------- dice ----------
function pushRoll(r) { S.dice.history.unshift(r); S.dice.history = S.dice.history.slice(0, 20); S.trayOpen = true; }
function d20(label, modv, dmg, dmgLabel) {
  const a = die(20), b = die(20), mode = S.dice.mode;
  const r = { label, d20: true, mode, sides: [20], dice: [mode === 'adv' ? Math.max(a, b) : mode === 'dis' ? Math.min(a, b) : a], dropped: mode === 'adv' ? Math.min(a, b) : mode === 'dis' ? Math.max(a, b) : null, mod: modv, luck: 0, gained: false, dmg, dmgLabel };
  S.dice.mode = 'normal'; pushRoll(r); return r;
}
function rollExpr(label, expr, crit) {
  const r = { label, d20: false, expr: expr + (crit ? ' (crit)' : ''), base: expr, crit: !!crit, dice: [], sides: [], mod: 0, luck: 0 };
  const re = /([+-]?)\s*(\d*)d(\d+)|([+-]?)\s*(\d+)/gi; let m;
  while ((m = re.exec(expr || ''))) {
    if (m[3]) { const sign = m[1] === '-' ? -1 : 1; let n = parseInt(m[2] || '1', 10); if (crit) n *= 2; const sd = parseInt(m[3], 10); for (let i = 0; i < n; i++) { r.dice.push(sign * die(sd)); r.sides.push(sd); } }
    else if (m[5]) r.mod += (m[4] === '-' ? -1 : 1) * parseInt(m[5], 10);
  }
  pushRoll(r); return r;
}
const total = r => r.dice.reduce((s, x) => s + x, 0) + r.mod + r.luck;
const reroll = r => r.d20 ? d20(r.label, r.mod, r.dmg, r.dmgLabel) : rollExpr(r.label, r.base || r.expr, r.crit);
function grouped(r) {
  if (!r.sides || r.sides.length !== r.dice.length) return `${esc(r.expr)} [${r.dice.join(', ')}]`;
  const order = [], g = {}; r.dice.forEach((v, i) => { const k = r.sides[i]; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(v); });
  return order.map(k => `d${k} [${g[k].join(', ')}]`).join(' + ') + (r.crit ? ' (crit)' : '');
}

// ---------- dice picker pool (mirror of Models/DicePool.cs) ----------
const STD_DICE = [4, 6, 8, 10, 12, 20, 100], MAX_DICE = 100, MOD_STEP_LIMIT = 20, MAX_MOD = 999;
const poolCount = p => Object.values(p.dice).reduce((a, b) => a + b, 0);
const poolSorted = p => Object.keys(p.dice).map(Number).sort((a, b) => a - b);
const poolExpr = p => poolSorted(p).map(k => `${p.dice[k]}d${k}`).join('+') + (p.mod ? (p.mod > 0 ? '+' : '-') + Math.abs(p.mod) : '');
function poolDisplay(p) {
  let s = poolSorted(p).map(k => `${p.dice[k]}d${k}`).join(' + ');
  if (p.mod) s += (s ? (p.mod > 0 ? ' + ' : ' − ') : (p.mod > 0 ? '' : '−')) + Math.abs(p.mod);
  return s;
}
function parsePool(text) {
  const c = (text || '').replace(/\s+/g, '').replace(/−/g, '-');
  if (!c) return { error: 'Enter dice like 2d6+3.' };
  if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/i.test(c)) return { error: 'Use dice and numbers joined by + or −, like 2d8+1d6+3.' };
  const out = { dice: {}, mod: 0 }; const re = /([+-]?)(?:(\d*)d(\d+)|(\d+))/gi; let m;
  while ((m = re.exec(c))) {
    const neg = m[1] === '-';
    if (m[3]) {
      if (neg) return { error: "Dice can't be subtracted. Use a negative number instead, like 1d8-1." };
      const n = m[2] ? parseInt(m[2], 10) : 1, sd = parseInt(m[3], 10);
      if (sd < 2 || sd > 1000) return { error: 'Dice need 2 to 1000 sides.' };
      if (n < 1) return { error: 'Each die needs a count of at least 1.' };
      if (poolCount(out) + n > MAX_DICE) return { error: `Roll up to ${MAX_DICE} dice at a time.` };
      out.dice[sd] = (out.dice[sd] || 0) + n;
    } else {
      const v = parseInt(m[4], 10); if (v > MAX_MOD) return { error: `Keep the modifier between −${MAX_MOD} and +${MAX_MOD}.` };
      out.mod += neg ? -v : v;
    }
  }
  if (!poolCount(out)) return { error: 'Add at least one die, like 1d20.' };
  if (Math.abs(out.mod) > MAX_MOD) return { error: `Keep the modifier between −${MAX_MOD} and +${MAX_MOD}.` };
  return { pool: out };
}
function syncPool() { S.pool.text = poolDisplay(S.pool); S.pool.err = ''; }

// ---------- state ----------
const S = {
  route: 'sheet', charId: null, tab: 'main', chars: [], user: emptyLib(), disabled: [],
  dice: { mode: 'normal', history: [] }, trayOpen: true, picker: false, pool: { dice: {}, mod: 0, text: '', err: '' }, hpAmt: 0, modal: null, notice: '', castMsg: '',
  wiz: null, set: { kind: 'lineages', search: '', draft: null, isNew: false, core: false, json: false, jsonText: '', err: '', msg: '' },
  pick: {}, lu: null, sort: 'level'
};
const C = () => S.chars.find(c => c.id === S.charId);
function persist() { store.set('vs.chars', S.chars); store.set('vs.content', S.user); store.set('vs.disabled', S.disabled); }
function save() { const c = C(); if (c) c.updated = new Date().toISOString(); persist(); }

function exampleCharacter() {
  const w = { name: 'Brannoc Ironvale', playerName: 'Example', lineage: 'dwarf', heritage: 'fireforge', background: 'soldier', cls: 'fighter',
    base: [15, 12, 14, 8, 13, 10], plus2: 'STR', plus1: 'CON', skills: ['Perception', 'Survival'], items: ['chain-mail', 'longsword', 'shield', 'light-crossbow', 'backpack', 'rations'], gold: false, talent: '' };
  const c = buildCharacter(w);
  applyLevelUp(c, { roll: false, mode: 'two' });
  c.example = true; c.experience = 950; c.luck = 2; c.currentHp = c.maxHp - 6; c.tempHp = 3;
  c.backstory = 'Example character. Raised in the forge-halls, Brannoc served as a shield-bearer before taking up the adventuring life.';
  return c;
}

// ---------- rendering ----------
const root = document.getElementById('root');
function render() {
  pendingRender = false;
  const f = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.f : null;
  const sel = f && document.activeElement.selectionStart != null ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  root.innerHTML = header() + '<main class="wrap">' + body() + '</main>' + modal();
  if (f) { const el = root.querySelector(`[data-f="${CSS.escape(f)}"]`); if (el) { el.focus(); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
}
function header() {
  const nav = (r, label) => `<button class="btn btn-sm ${S.route === r || (r === 'list' && S.route === 'sheet' && false) ? 'btn-primary' : ''}" data-act="go" data-a="${r}">${label}</button>`;
  return `<header class="topbar"><div class="topbar-in">
    <button class="brand display" data-act="go" data-a="list"><span aria-hidden="true">⚔</span> Valiant Sheet</button>
    <span class="chip hide-sm">Preview of the Blazor prototype</span>
    <nav class="ml-auto flex gap-1">${nav('list', 'Characters')}${nav('settings', 'Content')}</nav></div></header>`;
}
function body() {
  if (S.route === 'list') return listView();
  if (S.route === 'create') return createView();
  if (S.route === 'settings') return settingsView();
  const c = C(); if (!c) { S.route = 'list'; return listView(); }
  return sheetView(c);
}

// field helpers. data-f is the binding path; data-t the type.
const inp = (f, v, cls = '', extra = '') => `<input class="field ${cls}" data-f="${f}" data-t="s" value="${esc(v)}" ${extra}>`;
const num = (f, v, cls = '', extra = '') => `<input type="number" class="field num ${cls}" data-f="${f}" data-t="n" value="${esc(v)}" ${extra}>`;
const area = (f, v, rows = 3, extra = '') => `<textarea class="area" rows="${rows}" data-f="${f}" data-t="s" ${extra}>${esc(v)}</textarea>`;
const chk = (f, v, label = '') => `<input type="checkbox" data-f="${f}" data-t="b" ${v ? 'checked' : ''} aria-label="${esc(label)}">`;
const box = (title, inner, cls = '', actions = '') => `<section class="box ${cls}">${title ? `<div class="box-title">${title}</div>` : ''}${actions ? `<div class="box-actions">${actions}</div>` : ''}${inner}</section>`;
const pips = (act, count, value, variant = '', large = false, label = '') => `<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="${label}">${Array.from({ length: count }, (_, i) => `<button class="pip ${large ? 'lg' : ''} ${variant} ${i + 1 <= value ? 'on' : ''}" data-act="${act}" data-a="${i + 1}" title="${label} ${i + 1}">${large ? i + 1 : ''}</button>`).join('')}</div>`;

function listView() {
  const cards = S.chars.slice().sort((a, b) => (b.updated || '').localeCompare(a.updated || '')).map(c => `
    <div class="box flex flex-col gap-2">
      <button class="text-left" data-act="open" data-a="${c.id}">
        <div class="flex items-center gap-2"><span class="display font-bold text-lg truncate" style="color:var(--ink)">${esc(c.name)}</span>${c.example ? '<span class="chip user">Example</span>' : ''}</div>
        <div>${esc(c.className)} ${c.level}${c.subclassName ? ' · ' + esc(c.subclassName) : ''}</div>
        <div class="muted text-sm">${[c.lineageName, c.heritageName, c.backgroundName].filter(Boolean).map(esc).join(' · ')}</div>
      </button>
      <div class="flex gap-3 text-sm"><span>HP <b class="num">${c.currentHp}/${c.maxHp}</b></span><span>AC <b class="num">${ac(c, !!wornShield(c))}</b></span><span>Luck <b class="num">${c.luck}</b></span></div>
      <div class="flex gap-1.5 flex-wrap mt-auto">
        <button class="btn btn-sm btn-primary" data-act="open" data-a="${c.id}">Open</button>
        <button class="btn btn-sm" data-act="dupChar" data-a="${c.id}">Duplicate</button>
        <button class="btn btn-sm" data-act="exportChar" data-a="${c.id}">Export</button>
        <button class="btn btn-sm btn-danger ml-auto" data-act="delChar" data-a="${c.id}">Delete</button>
      </div>
    </div>`).join('');
  return `<div class="flex flex-wrap items-end gap-3 mb-4"><div><h1 class="display font-extrabold text-2xl" style="color:var(--ink)">Your characters</h1>
    <p class="muted">Saved in this browser. Pick one to open the sheet.</p></div>
    <button class="btn btn-primary ml-auto" data-act="startCreate">+ New character</button></div>
    ${S.chars.length ? `<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">${cards}</div>` : `<div class="box text-center py-8"><p class="mb-3">No saved characters yet.</p><button class="btn btn-primary" data-act="startCreate">Create your first character</button></div>`}
    <div class="box mt-6"><div class="box-title">Import a character</div><div class="flex justify-center"><input type="file" accept=".json,application/json" data-file="char" aria-label="Import character JSON"></div></div>`;
}

// ---------- sheet ----------
function sheetView(c) {
  const ready = c.level < 20 && c.experience >= XP[c.level + 1];
  const tabs = [['main', 'Main'], ['features', 'Equipment & Features'], ['holdings', 'Magic Items & Holdings'], ['character', 'Character'], ['spells', 'Spells']];
  const content = { main: mainTab, features: featuresTab, holdings: holdingsTab, character: characterTab, spells: spellsTab }[S.tab](c);
  return `<section class="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] gap-3 mb-3 items-start">
    <div class="box flex flex-col gap-1.5">
      <div><div class="flex items-center gap-2"><span class="font-semibold text-lg">${esc(c.className)} ${c.level}</span>
        <button class="btn btn-sm ml-auto ${ready ? 'btn-gold' : 'btn-primary'}" data-act="openLevel" ${c.level >= 20 ? 'disabled' : ''} title="Add the next level's features">${ready ? '★ Level up' : 'Level up'}</button></div><div class="lbl">Class &amp; level</div></div>
      <div><div class="truncate">${esc(c.subclassName || '—')}</div><div class="lbl">Subclass</div></div>
      <div><div class="flex items-center gap-2">${num('c.experience', c.experience, '', 'min="0" aria-label="Experience points"')}${c.level < 20 ? `<span class="muted text-sm whitespace-nowrap">/ ${XP[c.level + 1]}</span>` : ''}</div><div class="lbl">Experience points</div></div>
    </div>
    <div class="box text-center" style="border-width:3px">
      ${inp('c.name', c.name, 'display font-extrabold text-2xl text-center name-field', 'aria-label="Character name"')}<div class="lbl mt-0.5">Character name</div>
      ${inp('c.playerName', c.playerName, 'text-center mt-2', 'aria-label="Player name"')}<div class="lbl mt-0.5">Player name</div>
    </div>
    <div class="box flex flex-col gap-1.5">
      <div>${inp('c.lineageName', c.lineageName, '', 'aria-label="Lineage"')}<div class="lbl">Lineage</div></div>
      <div>${inp('c.heritageName', c.heritageName, '', 'aria-label="Heritage"')}<div class="lbl">Heritage</div></div>
      <div>${inp('c.backgroundName', c.backgroundName, '', 'aria-label="Background"')}<div class="lbl">Background</div></div>
    </div></section>
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <nav class="tabs flex-1 min-w-0" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${S.tab === k}" class="tab ${S.tab === k ? 'active' : ''}" data-act="tab" data-a="${k}">${l}</button>`).join('')}</nav>
      <div class="flex gap-1.5"><button class="btn btn-sm" data-act="shortRest">Short rest</button><button class="btn btn-sm" data-act="longRest">Long rest</button></div>
    </div>
    ${S.notice ? `<p class="text-sm mb-2" style="color:var(--good)">${esc(S.notice)}</p>` : ''}
    ${content}${tray(c)}`;
}

function abilityBlock(c, a) {
  const i = ABIL.indexOf(a);
  const skills = SKILLS.filter(s => s[1] === a).map(([name]) => {
    const p = skP(c, name);
    return `<div class="skill-row"><button class="pip ${p === 'Proficient' ? 'on' : p === 'Expertise' ? 'exp' : ''}" data-act="cycleSkill" data-a="${esc(name)}" title="${esc(name)}: ${p} (click to change)"></button>
      <button class="roll num bonus" data-act="rollSkill" data-a="${esc(name)}" title="Roll ${esc(name)}">${sg(skB(c, name))}</button><span>${esc(name)}</span></div>`;
  }).join('');
  return box(ABN[a], `<div class="flex justify-center"><button class="mod-circle num" data-act="rollCheck" data-a="${a}" title="Roll ${ABN[a]} check">${sg(M(c, a))}</button>
    <div class="score-circle" title="Ability score"><input type="number" min="1" max="30" data-f="c.scores.${i}" data-t="n" value="${c.scores[i]}" aria-label="${a} score"></div></div>
    <div class="flex items-center gap-2 mt-2 pt-1.5" style="border-top:1px solid var(--ink-faint)"><button class="pip ${c.saveProficiencies[i] ? 'on' : ''}" data-act="toggleSave" data-a="${i}" title="Toggle save proficiency"></button>
    <button class="roll num" data-act="rollSave" data-a="${a}" title="Roll save">${sg(saveB(c, a))}</button><span class="lbl">Save</span></div>${skills}`);
}
const profToggle = (f, v, label) => `<label class="flex items-center gap-2 cursor-pointer select-none"><button class="pip ${v ? 'on' : ''}" data-act="toggle" data-a="${f}" aria-pressed="${v}"></button><span>${label}</span></label>`;

function mainTab(c) {
  const armor = wornArmor(c), shield = wornShield(c);
  const armorNote = a => !a ? '' : `${a.category}, ${a.category === 'Heavy' ? 'no DEX' : a.category === 'Medium' ? '+ DEX (max 2)' : '+ DEX'}${a.magicBonus ? ', ' + sg(a.magicBonus) + ' magic' : ''}${a.properties ? ' · ' + esc(a.properties) : ''}`;
  const attacks = c.weapons.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Name</th><th>Bonus</th><th>Damage / Type</th><th>Range / Properties</th><th>Weapon Options</th></tr></thead><tbody>
    ${c.weapons.map((w, i) => `<tr><td class="font-semibold">${esc(w.name)}</td><td><button class="roll num" data-act="attack" data-a="${i}" title="Roll attack">${sg(atkB(c, w))}</button></td>
    <td class="whitespace-nowrap"><button class="roll num" data-act="damage" data-a="${i}" title="Roll damage">${esc(dmgExpr(c, w))}</button> <span class="muted">${esc(w.damageType)}</span></td>
    <td class="text-sm">${[w.range, w.properties].filter(Boolean).map(esc).join(' · ')}</td><td class="text-sm muted">${esc(w.options)}</td></tr>`).join('')}</tbody></table></div>`
    : `<p class="muted text-sm text-center py-2">No weapons yet. Add them on the Equipment &amp; Features tab.</p>`;
  const talentOpts = ['Magic', 'Martial', 'Technical'].map(cat => `<optgroup label="${cat}">${lib('talents').filter(t => t.category === cat).map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
  return `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.5fr)]">
  <div class="flex flex-col gap-3">
    ${box('Proficiency Bonus', `<div class="text-center num text-3xl" style="color:var(--ink)">${sg(P(c))}</div><div class="text-center muted text-xs">from level ${c.level}</div>`)}
    ${abilityBlock(c, 'STR')}${abilityBlock(c, 'DEX')}${abilityBlock(c, 'CON')}
    ${box('Luck', `<div class="flex justify-center">${pips('setLuck', MAX_LUCK, c.luck, 'luck', true, 'Luck')}</div><p class="muted text-xs text-center mt-1.5">Gain 1 when you fail a d20 test. Spend from the roll tray for +1 each.</p>`)}
  </div>
  <div class="flex flex-col gap-3">${abilityBlock(c, 'INT')}${abilityBlock(c, 'WIS')}${abilityBlock(c, 'CHA')}</div>
  <div class="flex flex-col gap-3 md:col-span-2 xl:col-span-1 min-w-0">
    <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
      ${box('Passive Insight', `<div class="text-center num text-2xl">${passive(c, 'Insight')}</div>`)}
      ${box('Passive Invest.', `<div class="text-center num text-2xl">${passive(c, 'Investigation')}</div>`)}
      ${box('Passive Percep.', `<div class="text-center num text-2xl">${passive(c, 'Perception')}</div>`)}
      ${box('Initiative', `<div class="text-center"><button class="roll num text-2xl" data-act="rollInit" title="Roll initiative">${sg(initB(c))}</button></div>`)}
      ${box('Speed(s)', inp('c.speed', c.speed, 'text-center num text-lg', 'aria-label="Speed"'))}
    </div>
    ${box('Attacks', attacks)}
    ${box('Armor', `<div class="flex items-center gap-3"><div class="shield" title="Armor class with shield"><span class="num text-2xl">${ac(c, true)}</span><span class="lbl text-center leading-tight">AC<br>with shield</span></div>
      <div class="flex-1 min-w-0 scroll-x"><table class="tbl"><thead><tr><th>Name</th><th>Base AC</th><th>Properties</th></tr></thead><tbody>
      <tr><td class="font-semibold">${esc(armor ? armor.name : 'Unarmored')}</td><td class="num">${armor ? armor.baseAC : '10 + DEX'}</td><td class="text-sm">${armorNote(armor)}</td></tr>
      ${shield ? `<tr><td class="font-semibold">${esc(shield.name)}</td><td class="num">+${shield.baseAC + (shield.magicBonus || 0)}</td><td class="text-sm">${esc(shield.properties)}</td></tr>` : ''}</tbody></table></div>
      <div class="shield" title="Armor class without shield"><span class="num text-2xl">${ac(c, false)}</span><span class="lbl text-center leading-tight">AC<br>no shield</span></div></div>`)}
    <div class="grid sm:grid-cols-3 gap-3">
      ${box('Hit Points', `<div class="grid grid-cols-3 gap-1.5 text-center">
        <div><div class="lbl">Max</div>${num('c.maxHp', c.maxHp, 'text-center')}</div>
        <div><div class="lbl">Current</div>${num('c.currentHp', c.currentHp, 'text-center text-xl', `style="color:${c.maxHp > 0 && c.currentHp * 4 <= c.maxHp ? 'var(--danger)' : 'var(--text)'}"`)}</div>
        <div><div class="lbl">Temp</div>${num('c.tempHp', c.tempHp, 'text-center')}</div></div>
        <div class="flex items-center gap-1 mt-2"><input type="number" min="0" class="field-box num w-16" placeholder="0" data-f="hpAmt" data-t="n" value="${S.hpAmt || ''}" aria-label="Amount">
        <button class="btn btn-sm btn-danger" data-act="hp" data-a="dmg" title="Temp HP is used first">Dmg</button><button class="btn btn-sm" data-act="hp" data-a="heal">Heal</button><button class="btn btn-sm" data-act="hp" data-a="temp" title="Temp HP doesn't stack: keeps the higher value">Temp</button></div>
        <div class="box-title mt-3">Hit Dice</div><div class="grid grid-cols-3 gap-1.5 text-center">
        <div><div class="lbl">Type</div><div class="num">d${c.hitDie}</div></div><div><div class="lbl">Used</div>${num('c.hitDiceUsed', c.hitDiceUsed, 'text-center', `min="0" max="${c.level}"`)}</div><div><div class="lbl">Max</div><div class="num">${c.level}</div></div></div>
        <button class="btn btn-sm w-full mt-2" data-act="hitDie" ${c.hitDiceUsed >= c.level ? 'disabled' : ''}>Spend hit die (d${c.hitDie}${sg(M(c, 'CON'))})</button>`)}
      ${box('Proficiencies', `<div class="space-y-1">${profToggle('lightArmor', c.lightArmor, 'Light Armor')}${profToggle('mediumArmor', c.mediumArmor, 'Medium Armor')}${profToggle('heavyArmor', c.heavyArmor, 'Heavy Armor')}${profToggle('shields', c.shields, 'Shields')}${profToggle('simpleWeapons', c.simpleWeapons, 'Simple Weapons')}${profToggle('martialWeapons', c.martialWeapons, 'Martial Weapons')}</div>`)}
      ${box('Languages', area('c.languages', c.languages, 3) + `<div class="box-title mt-2">Other Proficiencies</div>` + area('c.otherProficiencies', c.otherProficiencies, 3))}
    </div>
    <div class="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
      <div class="flex flex-col gap-3">
        ${box('Death Saves', `<div class="flex items-center justify-between gap-2">${pips('setDS', 3, c.deathSuccesses, 'goodpip', false, 'Success')}<span class="lbl">Successes</span></div>
          <div class="flex items-center justify-between gap-2 mt-1">${pips('setDF', 3, c.deathFailures, 'bad', false, 'Failure')}<span class="lbl">Failures</span></div><button class="btn btn-sm w-full mt-2" data-act="deathSave">Roll death save</button>`)}
        ${box('Exhaustion', `<div class="flex justify-center">${pips('setEx', 6, c.exhaustion, '', true, 'Exhaustion')}</div><div class="box-title mt-3">Conditions</div>${area('c.conditions', c.conditions, 2, 'placeholder="e.g. Poisoned, Prone"')}`)}
      </div>
      ${box('Talents', c.talents.map((t, i) => `<div class="py-1.5" style="border-bottom:1px solid var(--ink-faint)"><div class="flex items-center gap-2"><span class="font-semibold">${esc(t.name)}</span><span class="chip">${esc(t.category)}</span>
        <button class="icon-btn ml-auto" data-act="rm" data-a="talents.${i}" title="Remove talent">✕</button></div><div class="text-sm muted">${esc(t.description)}</div></div>`).join('') +
        `<div class="flex gap-1.5 mt-2"><select class="select" data-pick="talent" aria-label="Add talent"><option value="">Add a talent…</option>${talentOpts}</select><button class="btn btn-sm" data-act="addTalent">Add</button></div>`)}
    </div>
    ${box('Actions Quick Reference', `<div class="grid sm:grid-cols-3 gap-2"><div><div class="lbl text-center">Actions</div>${area('c.actionsRef', c.actionsRef, 4)}</div><div><div class="lbl text-center">Bonus Actions</div>${area('c.bonusActionsRef', c.bonusActionsRef, 4)}</div><div><div class="lbl text-center">Reactions</div>${area('c.reactionsRef', c.reactionsRef, 4)}</div></div>`)}
  </div></div>`;
}

function featuresTab(c) {
  const order = c.features.map((f, i) => [f, i]).sort((x, y) => S.sort === 'source' ? (x[0].source.localeCompare(y[0].source) || x[0].level - y[0].level) : (x[0].level - y[0].level || x[0].source.localeCompare(y[0].source)));
  const feats = order.map(([f, i]) => `<div class="rounded-lg p-2" style="border:1px solid var(--line)"><div class="flex items-start gap-2"><div class="min-w-0 flex-1">
    ${inp(`c.features.${i}.name`, f.name, 'font-semibold', 'aria-label="Feature name"')}
    <div class="flex gap-2 items-center mt-0.5"><span class="lbl">Level</span>${num(`c.features.${i}.level`, f.level, 'w-10 text-center', 'aria-label="Level"')}<span class="chip truncate">${esc(f.source)}</span></div></div>
    <button class="icon-btn" data-act="rm" data-a="features.${i}" title="Remove feature">✕</button></div>
    ${area(`c.features.${i}.description`, f.description, 2, 'style="min-height:3rem" aria-label="Description"')}
    ${f.usesMax > 0 ? `<div class="flex items-center gap-2 mt-1"><span class="lbl">Used</span>${pips('setUses:' + i, f.usesMax, f.usesSpent, '', false, 'Use')}<span class="muted text-xs ml-auto">${esc(f.recharge)}</span></div>` : ''}</div>`).join('');
  const weapons = c.weapons.map((w, i) => `<tr><td>${inp(`c.weapons.${i}.name`, w.name, 'font-semibold', 'aria-label="Name"')}</td><td>${inp(`c.weapons.${i}.damage`, w.damage, 'num w-16', 'aria-label="Damage dice"')}</td>
    <td>${inp(`c.weapons.${i}.damageType`, w.damageType, 'w-24', 'aria-label="Damage type"')}</td><td>${inp(`c.weapons.${i}.range`, w.range, 'w-20', 'aria-label="Range"')}</td>
    <td>${inp(`c.weapons.${i}.properties`, w.properties, 'text-sm', 'placeholder="Properties"')}${inp(`c.weapons.${i}.options`, w.options, 'text-sm', 'placeholder="Weapon options"')}</td>
    <td>${chk(`c.weapons.${i}.finesse`, w.finesse, 'Finesse')}</td><td>${chk(`c.weapons.${i}.ranged`, w.ranged, 'Ranged')}</td><td>${chk(`c.weapons.${i}.proficient`, w.proficient, 'Proficient')}</td>
    <td>${num(`c.weapons.${i}.magicBonus`, w.magicBonus, 'w-10', 'aria-label="Magic bonus"')}</td><td><button class="icon-btn" data-act="rm" data-a="weapons.${i}" title="Remove">✕</button></td></tr>`).join('');
  const armor = c.armor.map((a, i) => `<tr><td><button class="pip ${a.equipped ? 'on' : ''}" data-act="equip" data-a="${i}" title="Equip / unequip"></button></td>
    <td>${inp(`c.armor.${i}.name`, a.name, 'font-semibold', 'aria-label="Name"')}</td><td>${num(`c.armor.${i}.baseAC`, a.baseAC, 'w-12', 'aria-label="Base AC"')}</td>
    <td><select class="select" data-f="c.armor.${i}.category" data-t="s" ${a.isShield ? 'disabled' : ''} aria-label="Category">${['None', 'Light', 'Medium', 'Heavy'].map(x => `<option ${a.category === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
    <td>${chk(`c.armor.${i}.isShield`, a.isShield, 'Is shield')}</td><td>${num(`c.armor.${i}.magicBonus`, a.magicBonus, 'w-10', 'aria-label="Magic bonus"')}</td>
    <td>${inp(`c.armor.${i}.properties`, a.properties, 'text-sm', 'aria-label="Properties"')}</td><td><button class="icon-btn" data-act="rm" data-a="armor.${i}" title="Remove">✕</button></td></tr>`).join('');
  const itemOpts = ['Weapon', 'Armor', 'Shield', 'Gear'].map(t => `<optgroup label="${t}">${lib('items').filter(i => i.type === t).map(i => `<option value="${esc(i.id)}">${esc(i.name)}${i.cost ? ' (' + esc(i.cost) + ')' : ''}</option>`).join('')}</optgroup>`).join('');
  const gp = (c.coins.pp * 10 + c.coins.gp + c.coins.sp / 10 + c.coins.cp / 100);
  return `<div class="flex flex-col gap-3">
    ${box('Level Features', `${c.features.length ? '' : '<p class="muted text-sm text-center py-2">Features from your lineage, heritage, background, class and subclass appear here. Level up adds new ones automatically.</p>'}
      <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 mt-1">${feats}</div><button class="btn btn-sm mt-2" data-act="addFeature">+ Custom feature</button>`, '',
      `<select class="select text-sm" style="width:auto" data-f="sort" data-t="s" aria-label="Sort features"><option value="level" ${S.sort === 'level' ? 'selected' : ''}>By level</option><option value="source" ${S.sort === 'source' ? 'selected' : ''}>By source</option></select>`)}
    <div class="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3"><div class="flex flex-col gap-3 min-w-0">
      ${box('Weapons', `<div class="scroll-x"><table class="tbl" style="min-width:40rem"><thead><tr><th>Weapon</th><th>Damage</th><th>Type</th><th>Range</th><th>Properties / Options</th><th title="Finesse">Fin</th><th title="Ranged">Rng</th><th title="Proficient">Prof</th><th title="Magic bonus">+</th><th></th></tr></thead><tbody>${weapons}</tbody></table></div><p class="muted text-xs mt-1">Attack bonus and damage on the Main tab update from these values, your ability scores and proficiency bonus.</p>`)}
      ${box('Armor', `<div class="scroll-x"><table class="tbl" style="min-width:32rem"><thead><tr><th>Worn</th><th>Armor</th><th>Base AC</th><th>Category</th><th>Shield</th><th>+</th><th>Properties</th><th></th></tr></thead><tbody>${armor}</tbody></table></div><p class="muted text-xs mt-1">Wear one body armor and one shield at a time; AC recalculates when you change what's worn.</p>`)}
      <div class="flex flex-wrap gap-1.5 items-center"><select class="select" style="max-width:20rem" data-pick="item" aria-label="Add from library"><option value="">Add equipment from library…</option>${itemOpts}</select>
        <button class="btn btn-sm btn-primary" data-act="addItem">Add</button><span class="muted text-sm mx-1">or</span><button class="btn btn-sm" data-act="addWeapon">+ Weapon</button><button class="btn btn-sm" data-act="addArmor">+ Armor</button></div>
    </div><div class="flex flex-col gap-3 min-w-0">
      ${box('Other Equipment', c.gear.map((g, i) => `<div class="flex items-center gap-1.5">${num(`c.gear.${i}.quantity`, g.quantity, 'w-12 text-center', 'min="0" aria-label="Quantity"')}${inp(`c.gear.${i}.name`, g.name, '', 'aria-label="Item"')}<button class="icon-btn" data-act="rm" data-a="gear.${i}" title="Remove">✕</button></div>`).join('') + `<button class="btn btn-sm mt-2" data-act="addGear">+ Item</button>`)}
      ${box('Treasure &amp; Additional Items', `<div class="grid grid-cols-4 gap-2 text-center">${['pp', 'gp', 'sp', 'cp'].map(k => `<div><div class="lbl">${k.toUpperCase()}</div>${num('c.coins.' + k, c.coins[k], 'text-center')}</div>`).join('')}</div>
        <div class="muted text-xs text-center mt-1">Total ≈ ${Math.round(gp * 100) / 100} gp</div>${area('c.treasure', c.treasure, 5, 'placeholder="Gems, art objects, trade goods…"')}`)}
    </div></div></div>`;
}

function holdingsTab(c) {
  const att = attuned(c);
  return `<div class="flex flex-col gap-3">
    ${box('Magic Items', `<div class="flex items-center justify-center gap-2 mb-2"><span class="lbl">Attunement slots</span>${num('c.attunementSlots', c.attunementSlots, 'w-12 text-center', 'min="0"')}<span class="chip ${att > c.attunementSlots ? 'user' : ''}">${att} / ${c.attunementSlots} attuned</span></div>
      <div class="grid md:grid-cols-2 gap-2">${c.magicItems.map((m, i) => `<div class="rounded-lg p-2" style="border:1px solid var(--line)"><div class="flex items-center gap-2"><span class="lbl">Item</span>${inp(`c.magicItems.${i}.name`, m.name, 'font-semibold', 'aria-label="Item name"')}<button class="icon-btn" data-act="rm" data-a="magicItems.${i}" title="Remove">✕</button></div>
        <div class="flex items-center gap-3 mt-1"><label class="flex items-center gap-1.5 text-sm">${chk(`c.magicItems.${i}.requiresAttunement`, m.requiresAttunement, 'Requires attunement')} Requires attunement</label>
        <label class="flex items-center gap-1.5 text-sm ml-auto"><button class="pip ${m.attuned ? 'on' : ''}" data-act="attune" data-a="${i}" ${!m.attuned && att >= c.attunementSlots ? 'disabled' : ''} title="Attune"></button> Attuned</label></div>
        ${area(`c.magicItems.${i}.notes`, m.notes, 2, 'style="min-height:3rem" placeholder="Notes"')}</div>`).join('')}</div><button class="btn btn-sm mt-2" data-act="addMagic">+ Magic item</button>`)}
    ${box('Mounts &amp; Creatures', `<div class="grid md:grid-cols-2 gap-2">${c.mounts.map((m, i) => `<div class="rounded-lg p-2 grid grid-cols-4 gap-x-2 gap-y-1" style="border:1px solid var(--line)">
      <div class="col-span-2"><div class="lbl">Name</div>${inp(`c.mounts.${i}.name`, m.name, 'font-semibold')}</div><div><div class="lbl">Type</div>${inp(`c.mounts.${i}.type`, m.type)}</div><div class="flex items-end"><button class="icon-btn ml-auto" data-act="rm" data-a="mounts.${i}" title="Remove">✕</button></div>
      <div class="col-span-2"><div class="lbl">Speed</div>${inp(`c.mounts.${i}.speed`, m.speed)}</div><div class="col-span-2"><div class="lbl">Carrying capacity</div>${inp(`c.mounts.${i}.carryingCapacity`, m.carryingCapacity)}</div>
      <div class="col-span-4"><div class="lbl">Notes</div>${area(`c.mounts.${i}.notes`, m.notes, 2, 'style="min-height:3rem"')}</div></div>`).join('')}</div><button class="btn btn-sm mt-2" data-act="addMount">+ Mount or creature</button>`)}
    ${box('Vehicles', `<div class="grid md:grid-cols-2 gap-2">${c.vehicles.map((v, i) => `<div class="rounded-lg p-2 grid grid-cols-6 gap-x-2 gap-y-1" style="border:1px solid var(--line)">
      <div class="col-span-3"><div class="lbl">Name</div>${inp(`c.vehicles.${i}.name`, v.name, 'font-semibold')}</div><div class="col-span-2"><div class="lbl">Type</div>${inp(`c.vehicles.${i}.type`, v.type)}</div><div class="flex items-end"><button class="icon-btn ml-auto" data-act="rm" data-a="vehicles.${i}" title="Remove">✕</button></div>
      <div><div class="lbl">Prof.</div>${chk(`c.vehicles.${i}.proficient`, v.proficient, 'Proficient')}</div><div><div class="lbl">AC</div>${num(`c.vehicles.${i}.ac`, v.ac)}</div><div class="col-span-2"><div class="lbl">Max HP</div>${num(`c.vehicles.${i}.maxHp`, v.maxHp)}</div><div class="col-span-2"><div class="lbl">Current HP</div>${num(`c.vehicles.${i}.currentHp`, v.currentHp)}</div>
      <div class="col-span-2"><div class="lbl">Speed (round)</div>${inp(`c.vehicles.${i}.speedRound`, v.speedRound)}</div><div class="col-span-2"><div class="lbl">Speed (travel)</div>${inp(`c.vehicles.${i}.speedTravel`, v.speedTravel)}</div><div class="col-span-2"><div class="lbl">Crew</div>${inp(`c.vehicles.${i}.crew`, v.crew)}</div>
      <div class="col-span-3"><div class="lbl">Passengers</div>${inp(`c.vehicles.${i}.passengers`, v.passengers)}</div><div class="col-span-3"><div class="lbl">Cargo capacity</div>${inp(`c.vehicles.${i}.cargo`, v.cargo)}</div>
      <div class="col-span-6"><div class="lbl">Notes</div>${area(`c.vehicles.${i}.notes`, v.notes, 2, 'style="min-height:3rem"')}</div></div>`).join('')}</div><button class="btn btn-sm mt-2" data-act="addVehicle">+ Vehicle</button>`)}
    <div class="grid md:grid-cols-3 gap-3">${box('Base', inp('c.baseName', c.baseName, 'font-semibold', 'placeholder="Name and location"') + '<div class="lbl mt-2">Notes</div>' + area('c.baseNotes', c.baseNotes, 5))}${box('Facilities', area('c.facilities', c.facilities, 8))}${box('Personnel', area('c.personnel', c.personnel, 8))}</div>
  </div>`;
}

function characterTab(c) {
  const f = (k, l) => `<div><div class="lbl">${l}</div>${inp('c.' + k, c[k])}</div>`;
  return `<div class="grid lg:grid-cols-2 gap-3"><div class="flex flex-col gap-3">
    ${box('Character Appearance', `<div class="grid sm:grid-cols-[12rem_minmax(0,1fr)] gap-3"><div>
      <div class="portrait">${c.portraitUrl ? `<img src="${esc(c.portraitUrl)}" alt="Portrait of ${esc(c.name)}">` : '<span class="lbl">Portrait</span>'}</div>
      ${inp('c.portraitUrl', c.portraitUrl, 'text-sm mt-1', 'placeholder="Image URL" aria-label="Portrait image URL"')}</div>
      <div class="grid grid-cols-3 gap-x-2 gap-y-2 content-start"><div class="col-span-3"><div class="lbl">Character name</div><div class="display font-bold text-lg">${esc(c.name)}</div></div>
      ${f('age', 'Age')}${f('height', 'Height')}${f('weight', 'Weight')}${f('eyes', 'Eyes')}${f('skin', 'Skin')}${f('hair', 'Hair')}</div></div>
      <div class="lbl mt-3">Appearance notes</div>${area('c.appearanceNotes', c.appearanceNotes, 3)}`)}
    ${box('Personality', area('c.personality', c.personality, 6))}${box('Allies &amp; Organizations', area('c.allies', c.allies, 6))}
  </div><div class="flex flex-col gap-3">
    ${box('Backstory', area('c.backstory', c.backstory, 12) + `<div class="grid sm:grid-cols-2 gap-2 mt-2"><div><div class="lbl">Homeland</div>${area('c.homeland', c.homeland, 3)}</div><div><div class="lbl">Adventuring motivation</div>${area('c.motivation', c.motivation, 3)}</div></div>`)}
    ${box('Other Notes', area('c.otherNotes', c.otherNotes, 10))}
  </div></div>`;
}

function slotFor(c, s) { if (s.circle === 0) return 0; for (let k = s.circle; k <= 9; k++) if (c.slotsExpended[k - 1] < c.slotsTotal[k - 1]) return k; return null; }
function spellsTab(c) {
  const order = c.spells.map((s, i) => [s, i]).sort((a, b) => a[0].circle - b[0].circle || a[0].name.localeCompare(b[0].name));
  const groups = {}; lib('spells').forEach(s => (groups[s.circle] = groups[s.circle] || []).push(s));
  const spellOpts = Object.keys(groups).sort((a, b) => a - b).map(k => `<optgroup label="${+k === 0 ? 'Cantrips' : circ(+k) + ' circle'}">${groups[k].map(s => `<option value="${esc(s.id)}">${esc(s.name)}${s.tradition ? ' · ' + esc(s.tradition) : ''}</option>`).join('')}</optgroup>`).join('');
  return `<div class="flex flex-col gap-3"><div class="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
    ${box('Spellcasting', `<div class="lbl">Spellcaster class &amp; source</div>${inp('c.spellcasterClass', c.spellcasterClass, 'font-semibold')}
      <div class="lbl mt-2">Spellcasting ability</div><select class="select" data-f="c.spellAbility" data-t="ab"><option value="">None</option>${ABIL.map(a => `<option value="${a}" ${c.spellAbility === a ? 'selected' : ''}>${ABN[a]}</option>`).join('')}</select>
      <div class="grid grid-cols-2 gap-2 mt-3"><div class="field-box"><div class="lbl">Save DC</div><div class="num text-3xl" style="color:var(--ink)">${c.spellAbility ? spellDC(c) : '—'}</div></div>
      <div class="field-box"><div class="lbl">Attack bonus</div>${c.spellAbility ? `<button class="roll num text-3xl" style="color:var(--ink)" data-act="spellAtk" title="Roll spell attack">${sg(spellAtk(c))}</button>` : '<div class="num text-3xl">—</div>'}</div></div>`)}
    ${box('Spell Slots', `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">${Array.from({ length: 9 }, (_, i) => `<div class="rounded-lg px-2 py-1.5" style="border:1px solid var(--line)">
      <div class="flex items-center gap-2"><span class="display font-bold text-sm" style="color:var(--ink)">${circ(i + 1)} circle</span><span class="lbl ml-auto">Total</span>${num('c.slotsTotal.' + i, c.slotsTotal[i], 'w-9 text-center', `min="0" max="9" aria-label="${circ(i + 1)} circle slots"`)}</div>
      <div class="flex items-center gap-2 mt-1" style="min-height:1.25rem"><span class="lbl">Expended</span>${pips('setSlot:' + i, c.slotsTotal[i], c.slotsExpended[i], '', false, 'Expended')}</div></div>`).join('')}</div>`)}
    </div>
    ${box('Cantrips &amp; Spells', `<div class="scroll-x"><table class="tbl" style="min-width:48rem"><thead><tr><th>Circle</th><th>Spell Name</th><th>Cast Time</th><th>Range</th><th>Components</th><th>Duration</th><th>Conc.</th><th>Prepared</th><th></th><th></th></tr></thead><tbody>
      ${order.map(([s, i]) => { const slot = slotFor(c, s); return `<tr><td>${num(`c.spells.${i}.circle`, s.circle, 'w-9 text-center', 'min="0" max="9"')}</td>
        <td>${inp(`c.spells.${i}.name`, s.name, 'font-semibold')}${s.description ? `<div class="text-xs muted mt-0.5" style="max-width:20rem">${esc(s.description)}</div>` : ''}</td>
        <td>${inp(`c.spells.${i}.castingTime`, s.castingTime, 'text-sm w-24')}</td><td>${inp(`c.spells.${i}.range`, s.range, 'text-sm w-20')}</td><td>${inp(`c.spells.${i}.components`, s.components, 'text-sm')}</td><td>${inp(`c.spells.${i}.duration`, s.duration, 'text-sm w-24')}</td>
        <td class="text-center">${chk(`c.spells.${i}.concentration`, s.concentration, 'Concentration')}</td>
        <td class="text-center"><button class="pip ${s.prepared || s.circle === 0 ? 'on' : ''}" data-act="prep" data-a="${i}" title="Prepared"></button></td>
        <td><button class="btn btn-sm" data-act="cast" data-a="${i}" ${slot == null ? 'disabled' : ''} title="${slot === 0 ? 'Cantrip: no slot needed' : slot == null ? 'No slots left at this circle or higher' : 'Uses a ' + circ(slot) + '-circle slot'}">Cast</button></td>
        <td><button class="icon-btn" data-act="rm" data-a="spells.${i}" title="Remove">✕</button></td></tr>`; }).join('')}</tbody></table></div>
      ${S.castMsg ? `<p class="text-sm mt-1" style="color:var(--ink)">${esc(S.castMsg)}</p>` : ''}
      <div class="flex flex-wrap gap-1.5 items-center mt-2"><select class="select" style="max-width:20rem" data-pick="spell" aria-label="Add spell"><option value="">Add a spell from library…</option>${spellOpts}</select><button class="btn btn-sm btn-primary" data-act="addSpell">Add</button><button class="btn btn-sm" data-act="addCustomSpell">+ Custom spell</button></div>`)}
    ${box('Rituals', `<div class="scroll-x"><table class="tbl" style="min-width:36rem"><thead><tr><th>Circle</th><th>Ritual Name</th><th>Cast Time</th><th>Materials &amp; Cost</th><th>Duration</th><th></th></tr></thead><tbody>
      ${c.rituals.map((r, i) => `<tr><td>${num(`c.rituals.${i}.circle`, r.circle, 'w-9 text-center', 'min="1" max="9"')}</td><td>${inp(`c.rituals.${i}.name`, r.name, 'font-semibold')}</td><td>${inp(`c.rituals.${i}.castingTime`, r.castingTime, 'text-sm')}</td><td>${inp(`c.rituals.${i}.materials`, r.materials, 'text-sm')}</td><td>${inp(`c.rituals.${i}.duration`, r.duration, 'text-sm')}</td><td><button class="icon-btn" data-act="rm" data-a="rituals.${i}" title="Remove">✕</button></td></tr>`).join('')}</tbody></table></div>
      <div class="flex flex-wrap gap-1.5 items-center mt-2"><select class="select" style="max-width:20rem" data-pick="ritual" aria-label="Add ritual"><option value="">Add a ritual from library…</option>${lib('spells').filter(s => s.ritual).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><button class="btn btn-sm btn-primary" data-act="addRitual">Add</button><button class="btn btn-sm" data-act="addCustomRitual">+ Custom ritual</button></div>`)}
  </div>`;
}

function tray(c) {
  const r = S.dice.history[0], m = S.dice.mode;
  const mb = (k, l) => `<button class="btn btn-sm ${m === k ? 'btn-primary' : ''}" data-act="mode" data-a="${k}">${l}</button>`;
  let inner = '';
  if (S.trayOpen) {
    if (!r) inner = '<p class="muted text-sm mt-2">Click any bonus on the sheet to roll it.</p>';
    else {
      const nat = r.d20 ? r.dice[0] : 0, crit = r.d20 && nat === 20, fum = r.d20 && nat === 1;
      const bd = (r.d20 ? `d20 [${nat}]` + (r.dropped != null ? ` (${r.mode === 'adv' ? 'advantage' : 'disadvantage'}, dropped ${r.dropped})` : '') : grouped(r)) + (r.mod ? ' ' + sg(r.mod) : '') + (r.luck ? ` +${r.luck} Luck` : '') + (crit ? ' · natural 20!' : fum ? ' · natural 1' : '');
      inner = `<div class="flex items-end gap-3 mt-2"><div class="tray-total num ${crit ? 'crit' : fum ? 'fumble' : ''}">${total(r)}</div><div class="min-w-0 pb-0.5"><div class="font-semibold truncate">${esc(r.label)}</div><div class="muted text-sm">${bd}</div></div></div>
        <div class="flex flex-wrap gap-1.5 mt-2">${r.d20 ? `<button class="btn btn-sm btn-gold" data-act="spendLuck" ${c.luck <= 0 ? 'disabled' : ''} title="Spend 1 Luck to add +1 to this roll">Spend Luck +1 · ${c.luck}</button>
        <button class="btn btn-sm" data-act="gainLuck" ${r.gained || c.luck >= MAX_LUCK ? 'disabled' : ''} title="You gain 1 Luck when you fail a d20 test">Failed · +1 Luck</button>` : ''}
        <button class="btn btn-sm" data-act="reroll" data-a="0" title="Roll the same thing again">↻ Again</button>
        ${r.dmg ? `<button class="btn btn-sm btn-primary" data-act="rollDmg" data-a="0">Roll damage</button><button class="btn btn-sm" data-act="rollDmg" data-a="1">Crit damage</button>` : ''}</div>
        ${S.dice.history.length > 1 ? `<ul class="mt-2 pt-2 text-sm" style="border-top:1px solid var(--ink-faint)">${S.dice.history.slice(1, 5).map((h, i) => `<li class="flex items-center gap-2"><span class="num w-8 text-right">${total(h)}</span><span class="muted truncate flex-1">${esc(h.label)}</span><button class="icon-btn reroll" data-act="reroll" data-a="${i + 1}" title="Re-roll ${esc(h.label)}" aria-label="Re-roll ${esc(h.label)}">↻</button></li>`).join('')}</ul>` : ''}`;
    }
  }
  const p = S.pool, pc = poolCount(p);
  const picker = S.trayOpen && S.picker ? `<section class="picker" aria-label="Dice picker">
    <div class="die-row">${STD_DICE.map(sd => `<button class="die-btn ${p.dice[sd] ? 'on' : ''}" data-act="addDie" data-a="${sd}" title="Add a d${sd}">d${sd}${p.dice[sd] ? `<span class="die-count">${p.dice[sd]}</span>` : ''}</button>`).join('')}</div>
    ${pc ? `<div class="flex flex-wrap gap-1 mt-2">${poolSorted(p).map(k => `<span class="chip pool-chip">${p.dice[k]}d${k}<button class="chip-x" data-act="rmDie" data-a="${k}" aria-label="Remove one d${k}">−</button></span>`).join('')}</div>` : ''}
    <div class="flex items-center gap-1.5 mt-2"><span class="lbl">Modifier</span><button class="icon-btn" data-act="modStep" data-a="-1" aria-label="Lower modifier" ${p.mod <= -MOD_STEP_LIMIT ? 'disabled' : ''}>−</button><span class="num w-8 text-center">${sg(p.mod)}</span><button class="icon-btn" data-act="modStep" data-a="1" aria-label="Raise modifier" ${p.mod >= MOD_STEP_LIMIT ? 'disabled' : ''}>+</button></div>
    <label class="lbl" style="display:block;margin-top:.5rem" for="dice-expr">Or type a roll</label>
    <input id="dice-expr" class="field num" data-poolexpr="1" placeholder="e.g. 2d8+1d6+3" autocomplete="off" spellcheck="false" value="${esc(p.text)}">
    ${p.err ? `<p class="text-xs mt-1" style="color:var(--danger)">${esc(p.err)}</p>` : ''}
    <div class="flex gap-1.5 mt-2"><button class="btn btn-sm btn-primary btn-dice flex-1 truncate" data-act="poolRoll" ${!pc || p.err ? 'disabled' : ''}>${pc ? 'Roll ' + esc(poolDisplay(p)) : 'Pick dice to roll'}</button><button class="btn btn-sm" data-act="poolClear" ${!pc && !p.mod && !p.text ? 'disabled' : ''}>Clear</button></div>
  </section>` : '';
  return `<aside class="tray" aria-live="polite"><div class="flex items-center gap-1"><button class="btn btn-sm ${S.picker ? 'btn-primary' : ''}" data-act="pickerToggle" aria-expanded="${S.picker}" title="Pick any dice to roll">Dice</button><span class="lbl ml-auto mr-1">Next d20</span>${mb('normal', 'Normal')}${mb('adv', 'Adv')}${mb('dis', 'Dis')}<button class="icon-btn" data-act="trayToggle" title="${S.trayOpen ? 'Collapse' : 'Expand'}">${S.trayOpen ? '▾' : '▴'}</button></div>${picker}${inner}</aside>`;
}

// ---------- creation wizard ----------
const STEPS = ['Name', 'Lineage', 'Heritage', 'Background', 'Class', 'Abilities', 'Equipment', 'Talent', 'Review'];
function newWizard() { return { step: 0, name: '', playerName: '', lineage: '', heritage: '', background: '', cls: '', skills: [], method: 'standard', pool: STD.slice(), assign: [0, 1, 2, 3, 4, 5], base: STD.slice(), plus2: null, plus1: null, items: [], gold: false, talent: '' }; }
function skillsNeeded(w) { const cls = find('classes', w.cls); if (!cls) return 0; const bg = find('backgrounds', w.background); return Math.min(cls.skillChoices, cls.skillOptions.filter(s => !(bg && bg.skillProficiencies.includes(s))).length); }
const pbCost = s => s <= 8 ? 0 : s <= 13 ? s - 8 : s === 14 ? 7 : 9;
const pointsLeft = w => 27 - w.base.reduce((t, s) => t + pbCost(s), 0);
function bonusOpts(w) { const bg = find('backgrounds', w.background); return bg && bg.abilityOptions && bg.abilityOptions.length ? bg.abilityOptions : ABIL; }
function stepProblem(w, s) {
  if (s === 1 && !w.lineage) return 'Choose a lineage.';
  if (s === 2 && !w.heritage) return 'Choose a heritage.';
  if (s === 3 && !w.background) return 'Choose a background.';
  if (s === 4 && !w.cls) return 'Choose a class.';
  if (s === 4 && w.skills.length < skillsNeeded(w)) return `Choose ${skillsNeeded(w) - w.skills.length} more skill(s).`;
  if (s === 5 && (w.method === 'standard' || w.method === 'roll') && w.assign.some(a => a == null)) return 'Assign a value to every ability.';
  if (s === 5 && w.method === 'pointbuy' && pointsLeft(w) < 0) return "You've spent too many points.";
  if (s === 5 && (!w.plus2 || !w.plus1)) return 'Pick your background increases.';
  return null;
}
function maxReach(w) { let m = 0; for (let s = 0; s < STEPS.length - 1; s++) { if (stepProblem(w, s)) break; m = s + 1; } return Math.max(m, w.step); }
const traitList = ts => ts && ts.length ? `<ul class="mt-1.5 text-sm">${ts.map(t => `<li><b>${esc(t.name)}.</b> <span class="muted">${esc(t.description)}</span></li>`).join('')}</ul>` : '';
const choice = (sel, act, a, inner) => `<button class="choice ${sel ? 'selected' : ''}" data-act="${act}" data-a="${esc(a)}">${inner}</button>`;
function itemSummary(i) { if (!i) return ''; return i.type === 'Weapon' ? `${i.damage} ${i.damageType}` : i.type === 'Armor' ? `AC ${i.baseAC} · ${i.armorCategory}` : i.type === 'Shield' ? `+${i.baseAC} AC` : (i.cost || ''); }
function createView() {
  const w = S.wiz, s = w.step; let inner = '';
  if (s === 0) inner = `<h2 class="box-title text-left">Who are you?</h2><div class="grid sm:grid-cols-2 gap-4"><div><label class="lbl" for="wn">Character name</label><input id="wn" class="field text-xl display" data-f="w.name" data-t="s" value="${esc(w.name)}" autocomplete="off"></div><div><label class="lbl" for="wp">Player name</label><input id="wp" class="field text-xl" data-f="w.playerName" data-t="s" value="${esc(w.playerName)}"></div></div>`;
  else if (s === 1) inner = `<h2 class="box-title text-left">Choose a lineage</h2><p class="muted text-sm mb-3">Your lineage is your ancestry: size, speed and inborn traits.</p><div class="grid sm:grid-cols-2 gap-2">${lib('lineages').map(l => choice(w.lineage === l.id, 'wLineage', l.id, `<div class="flex items-center gap-2"><b>${esc(l.name)}</b><span class="chip ml-auto">${esc(l.source)}</span></div><div class="text-sm muted">${esc(l.size)} · ${l.speed} ft.</div><div class="text-sm mt-1">${esc(l.description)}</div>${traitList(l.traits)}`)).join('')}</div>`;
  else if (s === 2) inner = `<h2 class="box-title text-left">Choose a heritage</h2><p class="muted text-sm mb-3">Your heritage is the culture you were raised in: languages and learned traits.</p><div class="grid sm:grid-cols-2 gap-2">${lib('heritages').map(h => choice(w.heritage === h.id, 'wHeritage', h.id, `<div class="flex items-center gap-2"><b>${esc(h.name)}</b><span class="chip ml-auto">${esc(h.source)}</span></div><div class="text-sm muted">Languages: ${esc(h.languages)}</div><div class="text-sm mt-1">${esc(h.description)}</div>${traitList(h.traits)}`)).join('')}</div>`;
  else if (s === 3) inner = `<h2 class="box-title text-left">Choose a background</h2><p class="muted text-sm mb-3">What you did before adventuring: skills, tools, equipment and your ability increases.</p><div class="grid sm:grid-cols-2 gap-2">${lib('backgrounds').map(b => choice(w.background === b.id, 'wBackground', b.id, `<div class="flex items-center gap-2"><b>${esc(b.name)}</b><span class="chip ml-auto">${esc(b.source)}</span></div><div class="text-sm muted">Skills: ${b.skillProficiencies.map(esc).join(', ')}${b.toolProficiencies ? ' · Tools: ' + esc(b.toolProficiencies) : ''}</div><div class="text-sm mt-1">${esc(b.description)}</div>${traitList(b.traits)}`)).join('')}</div>`;
  else if (s === 4) {
    const cls = find('classes', w.cls), bg = find('backgrounds', w.background);
    inner = `<h2 class="box-title text-left">Choose a class</h2><div class="grid sm:grid-cols-2 gap-2">${lib('classes').map(k => choice(w.cls === k.id, 'wClass', k.id, `<div class="flex items-center gap-2"><b>${esc(k.name)}</b><span class="chip ml-auto">${esc(k.source)}</span></div><div class="text-sm muted">d${k.hitDie} hit die · Saves: ${k.savingThrows.join(', ')}${k.spellcastingAbility ? ' · Casts with ' + k.spellcastingAbility : ''}</div><div class="text-sm mt-1">${esc(k.description)}</div>`)).join('')}</div>`;
    if (cls) inner += `<h3 class="box-title text-left mt-5">Choose ${cls.skillChoices} skills</h3><div class="flex flex-wrap gap-1.5">${cls.skillOptions.map(sk => { const fromBg = bg && bg.skillProficiencies.includes(sk), picked = w.skills.includes(sk); return `<button class="btn btn-sm ${picked || fromBg ? 'btn-primary' : ''}" data-act="wSkill" data-a="${esc(sk)}" ${fromBg || (!picked && w.skills.length >= cls.skillChoices) ? 'disabled' : ''} title="${fromBg ? 'Already granted by your background' : ''}">${esc(sk)}</button>`; }).join('')}</div><p class="muted text-sm mt-1">${w.skills.length} of ${cls.skillChoices} chosen.</p>`;
  } else if (s === 5) {
    const mb = (k, l) => `<button class="btn btn-sm ${w.method === k ? 'btn-primary' : ''}" data-act="wMethod" data-a="${k}">${l}</button>`;
    const fin = a => finalScore(w, a);
    inner = `<h2 class="box-title text-left">Ability scores</h2><div class="flex flex-wrap gap-1.5 mb-3">${mb('standard', 'Standard array')}${mb('pointbuy', 'Point buy')}${mb('roll', 'Roll 4d6')}${mb('manual', 'Manual')}</div>
      ${w.method === 'pointbuy' ? `<p class="text-sm mb-2">Points left: <b class="num ${pointsLeft(w) < 0 ? 'fumble' : ''}">${pointsLeft(w)}</b> of 27</p>` : ''}
      ${w.method === 'roll' ? `<p class="text-sm mb-2"><button class="btn btn-sm btn-gold" data-act="wRoll">Roll six scores</button> <span class="ml-2 num">${w.pool.join(', ')}</span></p>` : ''}
      ${w.method === 'standard' || w.method === 'roll' ? '<p class="muted text-sm mb-2">Assign each value to one ability.</p>' : ''}
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">${ABIL.map((a, i) => {
        let ctl;
        if (w.method === 'standard' || w.method === 'roll') ctl = `<select class="select num text-center" data-f="w.assign.${i}" data-t="ni" aria-label="${ABN[a]}"><option value="">—</option>${w.pool.map((v, pi) => `<option value="${pi}" ${w.assign[i] === pi ? 'selected' : ''} ${w.assign.includes(pi) && w.assign[i] !== pi ? 'disabled' : ''}>${v}</option>`).join('')}</select>`;
        else if (w.method === 'pointbuy') ctl = `<div class="flex items-center justify-center gap-1"><button class="icon-btn" data-act="wBump" data-a="${i}:-1" ${w.base[i] <= 8 ? 'disabled' : ''} aria-label="Lower">−</button><span class="num text-xl w-8 text-center">${w.base[i]}</span><button class="icon-btn" data-act="wBump" data-a="${i}:1" ${w.base[i] >= 15 || pointsLeft(w) < pbCost(w.base[i] + 1) - pbCost(w.base[i]) ? 'disabled' : ''} aria-label="Raise">+</button></div>`;
        else ctl = `<input type="number" min="1" max="20" class="field num text-center text-xl" data-f="w.base.${i}" data-t="n" value="${w.base[i]}" aria-label="${ABN[a]}">`;
        return `<div class="field-box"><div class="lbl">${ABN[a]}</div>${ctl}<div class="mt-1 text-sm">${w.plus2 === a ? '<span class="chip user">+2</span> ' : ''}${w.plus1 === a ? '<span class="chip user">+1</span> ' : ''}<span class="num">= ${fin(a)} (${sg(mod(fin(a)))})</span></div></div>`;
      }).join('')}</div>
      <h3 class="box-title text-left mt-5">Background increases</h3><p class="muted text-sm mb-2">Your background raises one ability by 2 and another by 1.</p>
      <div class="grid sm:grid-cols-2 gap-3"><div><label class="lbl">+2 to</label><select class="select" data-f="w.plus2" data-t="ab"><option value="">—</option>${bonusOpts(w).map(a => `<option value="${a}" ${w.plus2 === a ? 'selected' : ''} ${w.plus1 === a ? 'disabled' : ''}>${ABN[a]}</option>`).join('')}</select></div>
      <div><label class="lbl">+1 to</label><select class="select" data-f="w.plus1" data-t="ab"><option value="">—</option>${bonusOpts(w).map(a => `<option value="${a}" ${w.plus1 === a ? 'selected' : ''} ${w.plus2 === a ? 'disabled' : ''}>${ABN[a]}</option>`).join('')}</select></div></div>`;
  } else if (s === 6) {
    const cls = find('classes', w.cls), bg = find('backgrounds', w.background);
    inner = `<h2 class="box-title text-left">Starting equipment</h2>` + (cls ? `<div class="flex flex-wrap gap-1.5 mb-3"><button class="btn btn-sm ${!w.gold ? 'btn-primary' : ''}" data-act="wGold" data-a="0">Take ${esc(cls.name)} gear</button><button class="btn btn-sm ${w.gold ? 'btn-primary' : ''}" data-act="wGold" data-a="1">Take ${cls.startingGold} gp instead</button></div>
      ${!w.gold ? `<div class="grid sm:grid-cols-2 gap-1.5">${cls.startingEquipment.map(id => { const it = find('items', id); const on = w.items.includes(id); return `<button class="choice flex items-center gap-2 ${on ? 'selected' : ''}" data-act="wItem" data-a="${esc(id)}"><span class="pip ${on ? 'on' : ''}" aria-hidden="true"></span><b>${esc(it ? it.name : id)}</b><span class="muted text-sm ml-auto">${esc(itemSummary(it))}</span></button>`; }).join('')}</div>` : ''}` : '<p class="muted">Choose a class first.</p>')
      + (bg && bg.equipment ? `<p class="mt-3 text-sm"><span class="lbl">From your background:</span> ${esc(bg.equipment)}</p>` : '');
  } else if (s === 7) {
    const bg = find('backgrounds', w.background), bt = bg && find('talents', bg.talentId);
    inner = `<h2 class="box-title text-left">Talent</h2>${bt ? `<p class="mb-3">Your background grants <b>${esc(bt.name)}</b>. <span class="muted text-sm">${esc(bt.description)}</span></p>` : ''}<p class="muted text-sm mb-2">Pick an additional talent if your lineage or GM grants one, or skip this step.</p>
      <div class="grid sm:grid-cols-2 gap-2">${lib('talents').map(t => choice(w.talent === t.id, 'wTalent', t.id, `<div class="flex items-center gap-2"><b>${esc(t.name)}</b><span class="chip ml-auto">${esc(t.category)}</span></div><div class="text-sm muted">${esc(t.description)}</div>${t.prerequisite ? `<div class="text-xs mt-0.5">Prerequisite: ${esc(t.prerequisite)}</div>` : ''}`)).join('')}</div>`;
  } else {
    const p = buildCharacter(w);
    const probs = [!w.lineage && 'No lineage chosen.', !w.heritage && 'No heritage chosen.', !w.background && 'No background chosen.', !w.cls && 'No class chosen.', (!w.plus2 || !w.plus1) && 'Background ability increases not chosen.'].filter(Boolean);
    inner = `<h2 class="box-title text-left">Review</h2><div class="grid sm:grid-cols-2 gap-4"><div><div class="display font-extrabold text-2xl" style="color:var(--ink)">${esc(p.name)}</div><div>${esc(p.className)} 1 · ${esc(p.lineageName)} · ${esc(p.heritageName)} · ${esc(p.backgroundName)}</div>
      <div class="grid grid-cols-6 gap-1 mt-3 text-center">${ABIL.map((a, i) => `<div class="field-box" style="padding:.25rem"><div class="lbl">${a}</div><div class="num">${p.scores[i]}</div><div class="text-xs muted">${sg(mod(p.scores[i]))}</div></div>`).join('')}</div>
      <div class="flex gap-4 mt-3"><span>HP <b class="num">${p.maxHp}</b></span><span>AC <b class="num">${ac(p, !!wornShield(p))}</b></span><span>Speed <b class="num">${esc(p.speed)}</b></span></div></div>
      <div class="text-sm" style="display:grid;gap:.25rem"><div><span class="lbl">Skills</span> ${Object.keys(p.skills).sort().map(esc).join(', ')}</div><div><span class="lbl">Features</span> ${p.features.map(f => esc(f.name)).join(', ')}</div>
      <div><span class="lbl">Talents</span> ${p.talents.length ? p.talents.map(t => esc(t.name)).join(', ') : '—'}</div><div><span class="lbl">Equipment</span> ${p.weapons.map(x => x.name).concat(p.armor.map(x => x.name), p.gear.map(x => x.name)).map(esc).join(', ')}</div><div><span class="lbl">Languages</span> ${esc(p.languages)}</div></div></div>
      ${probs.length ? `<ul class="mt-4 text-sm" style="color:var(--danger)">${probs.map(x => `<li>• ${x}</li>`).join('')}</ul>` : ''}`;
    w._ok = !probs.length;
  }
  const prob = stepProblem(w, s), reach = maxReach(w);
  return `<div class="narrow"><h1 class="display font-extrabold text-2xl" style="color:var(--ink)">Create a character</h1>
    <ol class="flex flex-wrap gap-1.5 my-4">${STEPS.map((n, i) => `<li><button class="btn btn-sm ${i === s ? 'btn-primary' : ''}" data-act="wStep" data-a="${i}" ${i > reach ? 'disabled' : ''}>${i + 1}. ${n}</button></li>`).join('')}</ol>
    <div class="box" style="padding:1.25rem">${inner}
    <div class="flex items-center gap-2 mt-6 pt-3" style="border-top:1px solid var(--line)"><button class="btn" data-act="wStep" data-a="${s - 1}" ${s === 0 ? 'disabled' : ''}>Back</button>${prob ? `<span class="muted text-sm">${prob}</span>` : ''}
    ${s < STEPS.length - 1 ? `<button class="btn btn-primary ml-auto" data-act="wStep" data-a="${s + 1}" ${prob ? 'disabled' : ''}>Next</button>` : `<button class="btn btn-primary ml-auto" data-act="wCreate" ${w._ok ? '' : 'disabled'}>Create character</button>`}</div></div></div>`;
}

// ---------- level up ----------
function levelModal(c) {
  const lu = S.lu, n = c.level + 1, cls = find('classes', c.classId), d = levelDef(cls, n), ns = needsSub(c, cls, n);
  const subs = lib('subclasses').filter(x => x.classId === c.classId), sub = lu.sub ? find('subclasses', lu.sub) : null;
  const g = gained(c, cls, ns ? sub : null, n);
  let missing = null;
  if (ns && subs.length && !sub) missing = 'Choose a subclass.';
  else if (d && d.grantsAbilityIncrease && !lu.a) missing = 'Choose an ability to increase.';
  else if (d && d.grantsAbilityIncrease && lu.mode === 'one' && !lu.b) missing = 'Choose a second ability.';
  else if (d && d.grantsTalent && !lu.talent) missing = 'Choose a talent.';
  else if (lu.roll && lu.rolled == null) missing = 'Roll your hit die.';
  lu._ok = !missing;
  const slots = d && d.spellSlots && d.spellSlots.length ? d.spellSlots.map((v, i) => v ? `${circ(i + 1)} ×${v}${c.slotsTotal[i] !== v ? ' (new)' : ''}` : '').filter(Boolean).join(', ') : '';
  const t = lu.talent && find('talents', lu.talent);
  return `<div class="modal-back" data-act="closeModal" data-self="1"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="lvl-title">
    <div class="modal-head"><h2 id="lvl-title" class="display font-extrabold text-xl" style="color:var(--ink)">Level up to ${n}</h2><span class="muted">${esc(c.className)}</span><button class="icon-btn ml-auto text-xl" data-act="closeModal" title="Close">✕</button></div>
    <div class="modal-body">
      ${!cls ? `<p class="text-sm" style="color:var(--danger)">The class "${esc(c.className)}" isn't in your content library, so no class features can be added. Level, hit points and proficiency bonus will still update.</p>` : ''}
      <section><h3 class="box-title text-left">Hit points</h3><div class="grid sm:grid-cols-2 gap-2">
        <button class="choice ${!lu.roll ? 'selected' : ''}" data-act="luAvg"><b>Take the average</b><div class="muted text-sm">${hitAvg(c.hitDie)} ${sg(M(c, 'CON'))} CON</div></button>
        <button class="choice ${lu.roll ? 'selected' : ''}" data-act="luRoll"><b>Roll d${c.hitDie}</b><div class="muted text-sm">${lu.rolled != null ? `Rolled ${lu.rolled} ${sg(M(c, 'CON'))} CON (click to reroll)` : 'Click to roll'}</div></button></div>
        <p class="mt-1.5">Max HP <span class="num">${c.maxHp}</span> → <span class="num" style="color:var(--good)">${c.maxHp + hpGain(c, lu)}</span></p></section>
      ${ns ? `<section><h3 class="box-title text-left">Choose your subclass</h3>${subs.length ? '' : `<p class="muted text-sm">No subclasses for ${esc(c.className)} in your content yet. You can add one in Content, or continue without.</p>`}
        <div class="grid sm:grid-cols-2 gap-2">${subs.map(x => choice(lu.sub === x.id, 'luSub', x.id, `<b>${esc(x.name)}</b><div class="muted text-sm">${esc(x.description)}</div>`)).join('')}</div></section>` : ''}
      ${d && d.grantsAbilityIncrease ? `<section><h3 class="box-title text-left">Ability score increase</h3><div class="flex gap-2 mb-2"><button class="btn btn-sm ${lu.mode === 'two' ? 'btn-primary' : ''}" data-act="luMode" data-a="two">+2 to one</button><button class="btn btn-sm ${lu.mode === 'one' ? 'btn-primary' : ''}" data-act="luMode" data-a="one">+1 to two</button></div>
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">${ABIL.map((a, i) => { const picked = lu.a === a || lu.b === a; const add = lu.mode === 'two' && lu.a === a ? 2 : picked ? 1 : 0; return `<button class="choice text-center ${picked ? 'selected' : ''}" data-act="luAb" data-a="${a}" ${c.scores[i] >= 20 ? 'disabled' : ''}><div class="lbl">${a}</div><div class="num text-lg">${c.scores[i]}${add ? ' → ' + Math.min(20, c.scores[i] + add) : ''}</div></button>`; }).join('')}</div></section>` : ''}
      ${d && d.grantsTalent ? `<section><h3 class="box-title text-left">Choose a talent</h3><select class="select" data-f="lu.talent" data-t="s"><option value="">Select a talent…</option>${['Magic', 'Martial', 'Technical'].map(cat => `<optgroup label="${cat}">${lib('talents').filter(x => x.category === cat).map(x => `<option value="${esc(x.id)}" ${lu.talent === x.id ? 'selected' : ''} ${c.talents.some(ct => ct.name === x.name) ? 'disabled' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select>
        ${t ? `<p class="text-sm muted mt-1">${esc(t.description)}${t.prerequisite ? ' Prerequisite: ' + esc(t.prerequisite) + '.' : ''}</p>` : ''}</section>` : ''}
      <section class="gain"><h3 class="box-title text-left">What you gain</h3><ul style="display:grid;gap:.3rem">
        ${profFor(n) !== P(c) ? `<li>Proficiency bonus <span class="num">${sg(P(c))}</span> → <span class="num" style="color:var(--good)">${sg(profFor(n))}</span></li>` : ''}
        <li>Hit dice <span class="num">${c.level}</span> → <span class="num">${n}</span> (d${c.hitDie})</li>${slots ? `<li>Spell slots: ${slots}</li>` : ''}
        ${g.map(f => `<li><b>${esc(f.name)}</b> <span class="chip">${esc(f.source)}</span> <span class="text-sm muted">${esc(f.description)}</span></li>`).join('') || '<li class="muted text-sm">No new features at this level.</li>'}</ul></section>
    </div>
    <div class="modal-foot">${missing ? `<span class="text-sm muted">${missing}</span>` : ''}<button class="btn ml-auto" data-act="closeModal">Cancel</button><button class="btn btn-primary" data-act="luApply" ${missing ? 'disabled' : ''}>Level up</button></div>
  </div></div>`;
}

// ---------- settings ----------
const ENUMS = { category: ['Magic', 'Martial', 'Technical'], type: ['Weapon', 'Armor', 'Shield', 'Gear'], armorCategory: ['None', 'Light', 'Medium', 'Heavy'], spellcastingAbility: ABIL };
const ENUM_LISTS = { savingThrows: ABIL, abilityOptions: ABIL };
const TEMPLATES = { traits: () => ({ name: '', level: 1, description: '', usesMax: 0, recharge: '' }), features: () => ({ name: '', level: 1, description: '', usesMax: 0, recharge: '' }), levels: (list) => ({ level: list.length + 1, features: [], grantsTalent: false, grantsAbilityIncrease: false, spellSlots: [] }) };
const BLANK = {
  lineages: () => ({ id: '', name: 'New lineage', source: 'Homebrew', description: '', size: 'Medium', speed: 30, traits: [] }),
  heritages: () => ({ id: '', name: 'New heritage', source: 'Homebrew', description: '', languages: 'Common', traits: [] }),
  backgrounds: () => ({ id: '', name: 'New background', source: 'Homebrew', description: '', skillProficiencies: [], toolProficiencies: '', abilityOptions: [], equipment: '', talentId: '', traits: [] }),
  classes: () => ({ id: '', name: 'New class', source: 'Homebrew', description: '', hitDie: 8, savingThrows: [], armorProficiencies: [], weaponProficiencies: [], otherProficiencies: '', skillOptions: [], skillChoices: 2, spellcastingAbility: null, subclassLevel: 3, startingEquipment: [], startingGold: 0, levels: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, features: [], grantsTalent: false, grantsAbilityIncrease: false, spellSlots: [] })) }),
  subclasses: () => ({ id: '', name: 'New subclass', source: 'Homebrew', description: '', classId: '', features: [] }),
  talents: () => ({ id: '', name: 'New talent', source: 'Homebrew', description: '', category: 'Martial', prerequisite: '' }),
  spells: () => ({ id: '', name: 'New spell', source: 'Homebrew', description: '', circle: 1, school: '', tradition: '', castingTime: '1 action', range: '', components: '', duration: 'Instantaneous', concentration: false, ritual: false }),
  items: () => ({ id: '', name: 'New item', source: 'Homebrew', description: '', type: 'Gear', weaponCategory: '', damage: '', damageType: '', range: '', properties: '', finesse: false, ranged: false, baseAC: 0, armorCategory: 'None', cost: '', weight: '' })
};
const HINTS = { id: 'Unique key. Reusing a built-in id overrides that entry.', source: "Book or homebrew label, e.g. 'Player's Guide', 'Homebrew'.", skillProficiencies: 'Skill names exactly as on the sheet.', abilityOptions: 'Abilities this background lets you raise.', talentId: 'Talent id granted at level 1 (optional).', armorProficiencies: 'Any of: Light, Medium, Heavy, Shields.', weaponProficiencies: 'Any of: Simple, Martial.', startingEquipment: 'Item ids from the Items list.', spellSlots: 'Total slots for circles 1-9, e.g. 4, 3, 2.', usesMax: '0 if it has no limited uses.', recharge: 'Short Rest, Long Rest or blank.', classId: 'Id of the parent class.', circle: '0 for cantrips.', subclassLevel: 'Level at which the subclass is chosen.' };
const label = k => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, x => x.toUpperCase());
function itemTitle(o, i, key) {
  if (key === 'levels') { const ex = []; if (o.features.length) ex.push(o.features.map(f => f.name || 'feature').join(', ')); if (o.grantsTalent) ex.push('talent'); if (o.grantsAbilityIncrease) ex.push('ability increase'); return `Level ${o.level}${ex.length ? ' — ' + ex.join(' · ') : ''}`; }
  return o.name ? `${o.name}${o.level != null ? ` (level ${o.level})` : ''}` : `Item ${i + 1}`;
}
function editor(obj, path, depth) {
  const keys = Object.keys(obj).sort((a, b) => { const r = k => ({ id: 0, name: 1, source: 2, description: 4 }[k] ?? 3); return r(a) - r(b); });
  return `<div class="ed-grid">${keys.map(k => {
    const v = obj[k], f = `${path}.${k}`, wide = Array.isArray(v) || k === 'description';
    let ctl;
    if (ENUMS[k]) ctl = `<select class="select" data-f="${f}" data-t="${k === 'spellcastingAbility' ? 'ab' : 's'}">${k === 'spellcastingAbility' ? '<option value="">None</option>' : ''}${ENUMS[k].map(o => `<option ${v === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    else if (ENUM_LISTS[k]) ctl = `<div class="flex flex-wrap gap-1">${ENUM_LISTS[k].map(o => `<button class="btn btn-sm ${v.includes(o) ? 'btn-primary' : ''}" data-act="edToggle" data-a="${f}|${o}">${o}</button>`).join('')}</div>`;
    else if (k === 'spellSlots') ctl = `<input class="field num" data-f="${f}" data-t="csvn" value="${esc(v.join(', '))}" placeholder="e.g. 4, 3, 2">`;
    else if (Array.isArray(v) && (v.length === 0 ? !TEMPLATES[k] : typeof v[0] === 'string')) ctl = `<input class="field" data-f="${f}" data-t="csv" value="${esc(v.join(', '))}" placeholder="Comma separated">`;
    else if (Array.isArray(v)) ctl = `<div class="flex flex-col gap-1.5">${v.map((o, i) => `<details class="ed-item" ${S.open && S.open[`${f}.${i}`] ? 'open' : ''} data-open="${f}.${i}"><summary><span class="font-semibold">${esc(itemTitle(o, i, k))}</span><button class="icon-btn ml-auto" data-act="edRemove" data-a="${f}|${i}" title="Remove">✕</button></summary><div class="p-2 pt-1">${editor(o, `${f}.${i}`, depth + 1)}</div></details>`).join('')}<button class="btn btn-sm" style="align-self:flex-start" data-act="edAdd" data-a="${f}|${k}">+ Add ${k === 'levels' ? 'level' : k === 'traits' ? 'trait' : 'feature'}</button></div>`;
    else if (typeof v === 'boolean') ctl = `<input type="checkbox" data-f="${f}" data-t="b" ${v ? 'checked' : ''}>`;
    else if (typeof v === 'number') ctl = `<input type="number" class="field num" style="width:7rem" data-f="${f}" data-t="n" value="${v}">`;
    else if (k === 'description') ctl = `<textarea class="area" rows="3" data-f="${f}" data-t="s">${esc(v)}</textarea>`;
    else ctl = `<input class="field" data-f="${f}" data-t="s" value="${esc(v)}" ${k === 'id' && S.set.core && depth === 0 ? 'readonly' : ''}>`;
    return `<div class="${wide ? 'ed-wide' : ''}" style="min-width:0"><label class="lbl" style="display:block;margin-bottom:.15rem">${label(k)}</label>${ctl}${HINTS[k] ? `<div class="text-xs muted mt-0.5">${HINTS[k]}</div>` : ''}</div>`;
  }).join('')}</div>`;
}
function summary(kind, e) {
  switch (kind) {
    case 'lineages': return `${e.size}, ${e.speed} ft. · ${e.traits.length} traits`;
    case 'heritages': return `${e.languages} · ${e.traits.length} traits`;
    case 'backgrounds': return e.skillProficiencies.join(', ');
    case 'classes': return `d${e.hitDie} · ${e.levels.length} levels · ${e.levels.reduce((t, l) => t + l.features.length, 0)} features`;
    case 'subclasses': return `${e.classId} · ${e.features.length} features`;
    case 'talents': return e.category;
    case 'spells': return `${circ(e.circle)}${e.circle ? ' circle' : ''} · ${e.school}${e.ritual ? ' · ritual' : ''}`;
    default: return e.type + (e.cost ? ' · ' + e.cost : '');
  }
}
function settingsView() {
  const st = S.set, k = KINDS.find(x => x[0] === st.kind);
  const rows = allEntries(st.kind).filter(r => !st.search || (r.e.name + ' ' + r.e.source).toLowerCase().includes(st.search.toLowerCase()));
  return `<div class="flex flex-wrap items-end gap-3 mb-4"><div><h1 class="display font-extrabold text-2xl" style="color:var(--ink)">Content library</h1>
    <p class="muted" style="max-width:42rem">Add lineages, heritages, backgrounds, classes, subclasses, talents, spells and items from books you own or your own homebrew. Character creation and level up use everything here. Built-in entries are samples: customize them to match your book.</p></div>
    <div class="ml-auto flex gap-1.5"><button class="btn btn-sm" data-act="exportContent">Export my content</button><label class="btn btn-sm" style="cursor:pointer">Import…<input type="file" accept=".json,application/json" data-file="content" hidden></label></div></div>
    ${st.msg ? `<p class="text-sm mb-3" style="color:var(--good)">${esc(st.msg)}</p>` : ''}
    <div class="grid lg:grid-cols-[13rem_minmax(0,1fr)] gap-4"><aside class="flex flex-col gap-3">
      <nav class="kind-nav">${KINDS.map(([key, l]) => `<button class="btn ${st.kind === key ? 'btn-primary' : ''}" data-act="setKind" data-a="${key}">${l} <span style="opacity:.7">(${allEntries(key).length})</span></button>`).join('')}</nav>
      ${box('Sources', `<p class="muted text-xs mb-1.5">Turn a source off to hide it from creation and level up.</p>${allSources().map(s => `<label class="flex items-center gap-2 text-sm py-0.5" style="cursor:pointer"><input type="checkbox" data-act="toggleSource" data-a="${esc(s)}" ${S.disabled.includes(s) ? '' : 'checked'}> <span class="truncate">${esc(s)}</span></label>`).join('')}`)}
    </aside>
    <section class="box min-w-0"><div class="flex flex-wrap items-center gap-2 mb-2"><h2 class="display font-bold text-lg" style="color:var(--ink)">${k[1]}</h2>
      <input class="field ml-auto" style="max-width:16rem" placeholder="Search…" aria-label="Search" data-search="1" autocomplete="off" value="${esc(st.search)}"><button class="btn btn-sm btn-primary" data-act="edNew">+ New</button></div>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Name</th><th>Source</th><th class="hide-sm">Details</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr data-text="${esc((r.e.name + ' ' + r.e.source).toLowerCase())}"><td><button class="roll font-semibold text-left" data-act="edOpen" data-a="${esc(r.e.id)}">${esc(r.e.name)}</button>${r.over ? ' <span class="chip user">customized</span>' : r.user ? ' <span class="chip user">yours</span>' : ''}</td>
        <td class="text-sm"><span class="chip" style="${S.disabled.includes(r.e.source) ? 'opacity:.5' : ''}">${esc(r.e.source)}</span></td><td class="text-sm muted hide-sm">${esc(summary(st.kind, r.e))}</td>
        <td class="whitespace-nowrap text-right"><button class="btn btn-sm" data-act="edOpen" data-a="${esc(r.e.id)}">${r.user ? 'Edit' : 'Customize'}</button> <button class="btn btn-sm" data-act="edCopy" data-a="${esc(r.e.id)}">Copy</button>${r.user ? ` <button class="btn btn-sm btn-danger" data-act="edDelete" data-a="${esc(r.e.id)}">${r.over ? 'Revert' : 'Delete'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
      ${rows.length ? '' : '<p class="muted text-center py-6">Nothing here yet.</p>'}</section></div>`;
}
function editorModal() {
  const st = S.set, k = KINDS.find(x => x[0] === st.kind);
  return `<div class="modal-back" data-act="closeModal" data-self="1"><div class="modal" style="width:min(56rem,100%)" role="dialog" aria-modal="true">
    <div class="modal-head"><h2 class="display font-extrabold text-lg" style="color:var(--ink)">${st.isNew ? 'New' : 'Edit'} ${k[2]}: ${esc(st.draft.name)}</h2><button class="btn btn-sm ml-auto" data-act="edJson">${st.json ? 'Form view' : 'Edit as JSON'}</button><button class="icon-btn text-xl" data-act="closeModal" title="Close">✕</button></div>
    <div class="modal-body">${st.core ? `<p class="text-sm muted">Saving creates your own copy that replaces the built-in "${esc(st.draft.name)}". You can revert it later.</p>` : ''}
      ${st.json ? `<textarea class="area mono" rows="22" data-f="set.jsonText" data-t="s">${esc(st.jsonText)}</textarea>` : editor(st.draft, 'set.draft', 0)}
      ${st.err ? `<p class="text-sm" style="color:var(--danger)">${esc(st.err)}</p>` : ''}</div>
    <div class="modal-foot"><button class="btn ml-auto" data-act="closeModal">Cancel</button><button class="btn btn-primary" data-act="edSave">Save</button></div></div></div>`;
}
function modal() {
  if (!S.modal) return '';
  if (S.modal === 'level') return levelModal(C());
  if (S.modal === 'editor') return editorModal();
  if (S.modal.confirm) return `<div class="modal-back"><div class="modal" style="width:min(26rem,100%)" role="alertdialog" aria-modal="true"><div class="modal-body"><p>${esc(S.modal.confirm)}</p></div><div class="modal-foot"><button class="btn ml-auto" data-act="closeModal">Cancel</button><button class="btn ${S.modal.danger ? 'btn-danger' : 'btn-primary'}" data-act="confirmYes">${esc(S.modal.yes || 'OK')}</button></div></div></div>`;
  if (S.modal.json) return `<div class="modal-back" data-act="closeModal" data-self="1"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2 class="display font-extrabold text-lg" style="color:var(--ink)">${esc(S.modal.title)}</h2><button class="icon-btn ml-auto text-xl" data-act="closeModal" title="Close">✕</button></div>
    <div class="modal-body"><p class="text-sm muted">Copy this JSON and save it as a .json file. It imports into this preview and into the Blazor app.</p><textarea id="jsonOut" class="area mono" rows="16" readonly>${esc(S.modal.json)}</textarea></div>
    <div class="modal-foot"><span class="text-sm muted" id="copyMsg"></span><button class="btn btn-primary ml-auto" data-act="copyJson">Copy</button></div></div></div>`;
  return '';
}

// ---------- paths ----------
function resolve(path) {
  const [head, ...rest] = path.split('.');
  const base = { c: C(), w: S.wiz, set: S.set, lu: S.lu }[head];
  if (head === 'hpAmt' || head === 'sort') return { obj: S, key: head };
  let o = base; for (let i = 0; i < rest.length - 1; i++) o = o[rest[i]];
  return { obj: o, key: rest[rest.length - 1] };
}
function coerce(el) {
  const t = el.dataset.t, v = el.type === 'checkbox' ? el.checked : el.value;
  if (t === 'n') { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  if (t === 'ni') return v === '' ? null : parseInt(v, 10);
  if (t === 'b') return !!v;
  if (t === 'ab') return v || null;
  if (t === 'csv') return v.split(',').map(s => s.trim()).filter(Boolean);
  if (t === 'csvn') return v.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  return v;
}
function bindChange(el) {
  const { obj, key } = resolve(el.dataset.f);
  obj[key] = coerce(el);
  const head = el.dataset.f.split('.')[0];
  if (head === 'w' && el.dataset.f.startsWith('w.assign')) S.wiz.base = S.wiz.assign.map(a => a != null && a < S.wiz.pool.length ? S.wiz.pool[a] : 8);
  if (head === 'c') { S.notice = ''; save(); }
}

// ---------- actions ----------
function cur() { return C(); }
const A = {
  go(r) { if (r === 'list') { S.route = 'list'; } else S.route = r; S.notice = ''; },
  open(id) { S.charId = id; S.route = 'sheet'; S.tab = 'main'; S.notice = ''; S.castMsg = ''; },
  startCreate() { S.wiz = newWizard(); S.route = 'create'; },
  dupChar(id) { const c = clone(S.chars.find(x => x.id === id)); c.id = uid(); c.name += ' (copy)'; c.updated = new Date().toISOString(); S.chars.push(c); persist(); },
  delChar(id) { const c = S.chars.find(x => x.id === id); S.modal = { confirm: `Delete ${c.name}? This can't be undone.`, yes: 'Delete', danger: true, then() { S.chars = S.chars.filter(x => x.id !== id); persist(); } }; },
  exportChar(id) { const c = S.chars.find(x => x.id === id); S.modal = { title: `Export ${c.name}`, json: JSON.stringify(c, null, 2) }; },
  tab(k) { S.tab = k; S.castMsg = ''; },
  rollCheck(a) { d20(`${ABN[a]} check`, M(cur(), a)); },
  rollSave(a) { d20(`${ABN[a]} save`, saveB(cur(), a)); },
  rollSkill(s) { d20(`${s} check`, skB(cur(), s)); },
  rollInit() { d20('Initiative', initB(cur())); },
  toggleSave(i) { const c = cur(); c.saveProficiencies[+i] = !c.saveProficiencies[+i]; save(); },
  cycleSkill(s) { const c = cur(), order = ['None', 'Proficient', 'Expertise'], next = order[(order.indexOf(skP(c, s)) + 1) % 3]; if (next === 'None') delete c.skills[s]; else c.skills[s] = next; save(); },
  toggle(f) { const c = cur(); c[f] = !c[f]; save(); },
  setLuck(n) { const c = cur(); c.luck = c.luck === +n ? +n - 1 : +n; save(); },
  setDS(n) { const c = cur(); c.deathSuccesses = c.deathSuccesses === +n ? +n - 1 : +n; save(); },
  setDF(n) { const c = cur(); c.deathFailures = c.deathFailures === +n ? +n - 1 : +n; save(); },
  setEx(n) { const c = cur(); c.exhaustion = c.exhaustion === +n ? +n - 1 : +n; save(); },
  attack(i) { const c = cur(), w = c.weapons[+i]; d20(`${w.name} attack`, atkB(c, w), dmgExpr(c, w), `${w.name} damage (${w.damageType})`); },
  damage(i) { const c = cur(), w = c.weapons[+i]; rollExpr(`${w.name} damage (${w.damageType})`, dmgExpr(c, w)); },
  hp(kind) { const c = cur(), n = S.hpAmt || 0; if (kind === 'dmg') takeDamage(c, n); else if (kind === 'heal') heal(c, n); else c.tempHp = Math.max(c.tempHp, n); S.hpAmt = 0; save(); },
  hitDie() { const c = cur(); const r = rollExpr('Hit die', `1d${c.hitDie}${sg(M(c, 'CON'))}`); c.hitDiceUsed++; heal(c, Math.max(0, total(r))); save(); },
  deathSave() { const c = cur(), r = d20('Death save', 0), n = r.dice[0]; if (n === 20) { c.currentHp = 1; c.deathSuccesses = 0; c.deathFailures = 0; } else if (n === 1) c.deathFailures = Math.min(3, c.deathFailures + 2); else if (n >= 10) c.deathSuccesses = Math.min(3, c.deathSuccesses + 1); else c.deathFailures = Math.min(3, c.deathFailures + 1); save(); },
  addTalent() { const t = find('talents', S.pick.talent); if (t) { addTalent(cur(), t); save(); } S.pick.talent = ''; },
  rm(p) { const [list, i] = p.split('.'); cur()[list].splice(+i, 1); save(); },
  mode(m) { S.dice.mode = m; },
  trayToggle() { S.trayOpen = !S.trayOpen; },
  pickerToggle() { S.picker = !S.picker; S.trayOpen = true; },
  addDie(sd) { if (poolCount(S.pool) >= MAX_DICE) { S.pool.err = `Roll up to ${MAX_DICE} dice at a time.`; return; } S.pool.dice[sd] = (S.pool.dice[sd] || 0) + 1; syncPool(); },
  rmDie(sd) { const n = S.pool.dice[sd] || 0; if (n <= 1) delete S.pool.dice[sd]; else S.pool.dice[sd] = n - 1; syncPool(); },
  modStep(d) { S.pool.mod = Math.max(-MOD_STEP_LIMIT, Math.min(MOD_STEP_LIMIT, S.pool.mod + +d)); syncPool(); },
  poolRoll() { const p = S.pool; if (!poolCount(p) || p.err) return; const label = 'Custom roll · ' + poolDisplay(p); if (poolCount(p) === 1 && p.dice[20]) d20(label, p.mod); else rollExpr(label, poolExpr(p)); },
  poolClear() { S.pool = { dice: {}, mod: 0, text: '', err: '' }; },
  reroll(i) { const r = S.dice.history[+i]; if (r) reroll(r); },
  spendLuck() { const c = cur(), r = S.dice.history[0]; if (c.luck > 0 && r) { c.luck--; r.luck++; save(); } },
  gainLuck() { const c = cur(), r = S.dice.history[0]; if (c.luck < MAX_LUCK && r && !r.gained) { c.luck++; r.gained = true; save(); } },
  rollDmg(crit) { const r = S.dice.history[0]; if (r && r.dmg) rollExpr(r.dmgLabel, r.dmg, crit === '1'); },
  shortRest() { cur().features.forEach(f => { if (/short/i.test(f.recharge)) f.usesSpent = 0; }); save(); S.notice = 'Short rest taken. Spend hit dice from the Hit Points box to heal.'; },
  longRest() { S.modal = { confirm: 'Take a long rest? HP, spell slots and feature uses are restored.', yes: 'Take long rest', then() { const c = cur(); c.currentHp = c.maxHp; c.tempHp = 0; c.hitDiceUsed = Math.max(0, c.hitDiceUsed - Math.max(1, Math.floor(c.level / 2))); c.deathSuccesses = 0; c.deathFailures = 0; c.exhaustion = Math.max(0, c.exhaustion - 1); c.slotsExpended = c.slotsExpended.map(() => 0); c.features.forEach(f => { if (f.usesMax > 0) f.usesSpent = 0; }); save(); S.notice = 'Long rest taken.'; } }; },
  // equipment
  addFeature() { const c = cur(); c.features.push({ name: 'New feature', level: c.level, source: 'Custom', description: '', usesMax: 0, usesSpent: 0, recharge: '' }); save(); },
  addWeapon() { cur().weapons.push({ name: 'New weapon', damage: '1d6', damageType: '', range: '', properties: '', options: '', finesse: false, ranged: false, proficient: true, magicBonus: 0, abilityOverride: null }); save(); },
  addArmor() { cur().armor.push({ name: 'New armor', baseAC: 11, category: 'Light', isShield: false, properties: '', magicBonus: 0, equipped: false }); save(); },
  addGear() { cur().gear.push({ name: '', quantity: 1, notes: '' }); save(); },
  addItem() { const i = find('items', S.pick.item); if (i) { addItem(cur(), i); save(); } S.pick.item = ''; },
  equip(i) { const c = cur(), a = c.armor[+i], on = !a.equipped; if (on) c.armor.forEach(x => { if (x.isShield === a.isShield) x.equipped = false; }); a.equipped = on; save(); },
  addMagic() { cur().magicItems.push({ name: '', requiresAttunement: false, attuned: false, notes: '' }); save(); },
  attune(i) { const c = cur(), m = c.magicItems[+i]; if (!m.attuned && attuned(c) >= c.attunementSlots) return; m.attuned = !m.attuned; save(); },
  addMount() { cur().mounts.push({ name: '', type: '', speed: '', carryingCapacity: '', notes: '' }); save(); },
  addVehicle() { cur().vehicles.push({ name: '', type: '', proficient: false, ac: 0, maxHp: 0, currentHp: 0, speedRound: '', speedTravel: '', crew: '', passengers: '', cargo: '', notes: '' }); save(); },
  // spells
  spellAtk() { d20('Spell attack', spellAtk(cur())); },
  prep(i) { const s = cur().spells[+i]; s.prepared = !s.prepared; save(); },
  cast(i) { const c = cur(), s = c.spells[+i], slot = slotFor(c, s); if (slot == null) return; if (slot > 0) c.slotsExpended[slot - 1]++; S.castMsg = slot === 0 ? `Cast ${s.name}.` : `Cast ${s.name} using a ${circ(slot)}-circle slot.${s.concentration ? ' Concentration started.' : ''}`; save(); },
  addSpell() { const s = find('spells', S.pick.spell); if (s) { cur().spells.push({ name: s.name, circle: s.circle, castingTime: s.castingTime, range: s.range, components: s.components, duration: s.duration, concentration: s.concentration, prepared: false, description: s.description }); save(); } S.pick.spell = ''; },
  addCustomSpell() { cur().spells.push({ name: 'New spell', circle: 1, castingTime: '', range: '', components: '', duration: '', concentration: false, prepared: false, description: '' }); save(); },
  addRitual() { const s = find('spells', S.pick.ritual); if (s) { cur().rituals.push({ name: s.name, circle: Math.max(1, s.circle), castingTime: s.castingTime + ' + 10 minutes', materials: s.components, duration: s.duration }); save(); } S.pick.ritual = ''; },
  addCustomRitual() { cur().rituals.push({ name: 'New ritual', circle: 1, castingTime: '', materials: '', duration: '' }); save(); },
  // level up
  openLevel() { S.lu = { roll: false, rolled: null, sub: '', mode: 'two', a: null, b: null, talent: '' }; S.modal = 'level'; },
  luAvg() { S.lu.roll = false; },
  luRoll() { const c = cur(); S.lu.roll = true; S.lu.rolled = total(rollExpr(`Level ${c.level + 1} hit die`, `1d${c.hitDie}`)); },
  luSub(id) { S.lu.sub = id; },
  luMode(m) { S.lu.mode = m; S.lu.a = null; S.lu.b = null; },
  luAb(a) { const lu = S.lu; if (lu.mode === 'two') { lu.a = lu.a === a ? null : a; return; } if (lu.a === a) lu.a = null; else if (lu.b === a) lu.b = null; else if (!lu.a) lu.a = a; else lu.b = a; },
  luApply() { if (!S.lu._ok) return; const c = cur(); applyLevelUp(c, S.lu); S.modal = null; save(); S.notice = `${c.name} is now level ${c.level}. New features are on the Equipment & Features tab.`; },
  closeModal() { S.modal = null; },
  confirmYes() { const m = S.modal; S.modal = null; if (m && m.then) m.then(); },
  copyJson() { const ta = document.getElementById('jsonOut'), msg = document.getElementById('copyMsg'); const done = () => { msg.textContent = 'Copied.'; }; const fallback = () => { ta.focus(); ta.select(); msg.textContent = 'Selected. Press Ctrl/Cmd+C to copy.'; }; try { navigator.clipboard.writeText(ta.value).then(done, fallback); } catch (e) { fallback(); } return 'norender'; },
  // wizard
  wStep(i) { S.wiz.step = Math.max(0, Math.min(STEPS.length - 1, +i)); window.scrollTo(0, 0); },
  wLineage(id) { S.wiz.lineage = id; },
  wHeritage(id) { S.wiz.heritage = id; },
  wBackground(id) { const w = S.wiz, bg = find('backgrounds', id); w.background = id; w.skills = w.skills.filter(s => !bg.skillProficiencies.includes(s)); const o = bonusOpts(w); if (w.plus2 && !o.includes(w.plus2)) w.plus2 = null; if (w.plus1 && !o.includes(w.plus1)) w.plus1 = null; },
  wClass(id) { const w = S.wiz; if (w.cls === id) return; w.cls = id; w.skills = []; w.items = find('classes', id).startingEquipment.slice(); },
  wSkill(s) { const w = S.wiz, cls = find('classes', w.cls), i = w.skills.indexOf(s); if (i >= 0) w.skills.splice(i, 1); else if (w.skills.length < cls.skillChoices) w.skills.push(s); },
  wMethod(m) { const w = S.wiz; w.method = m; w.assign = [null, null, null, null, null, null]; if (m === 'standard') { w.pool = STD.slice(); w.assign = [0, 1, 2, 3, 4, 5]; } if (m === 'roll') w.pool = []; if (m === 'pointbuy') w.base = [8, 8, 8, 8, 8, 8]; if (m === 'manual') w.base = [10, 10, 10, 10, 10, 10]; if (m === 'standard' || m === 'roll') w.base = w.assign.map(a => a != null && a < w.pool.length ? w.pool[a] : 8); },
  wRoll() { const w = S.wiz; w.pool = Array.from({ length: 6 }, () => [die(6), die(6), die(6), die(6)].sort((a, b) => b - a).slice(0, 3).reduce((s, x) => s + x, 0)).sort((a, b) => b - a); w.assign = [0, 1, 2, 3, 4, 5]; w.base = w.pool.slice(); },
  wBump(p) { const [i, d] = p.split(':').map(Number); S.wiz.base[i] = Math.min(15, Math.max(8, S.wiz.base[i] + d)); },
  wGold(v) { S.wiz.gold = v === '1'; },
  wItem(id) { const it = S.wiz.items, i = it.indexOf(id); if (i >= 0) it.splice(i, 1); else it.push(id); },
  wTalent(id) { S.wiz.talent = S.wiz.talent === id ? '' : id; },
  wCreate() { const c = buildCharacter(S.wiz); S.chars.push(c); persist(); S.charId = c.id; S.route = 'sheet'; S.tab = 'main'; S.wiz = null; },
  // settings
  setKind(k) { S.set.kind = k; S.set.search = ''; },
  toggleSource(s) { const i = S.disabled.indexOf(s); if (i >= 0) S.disabled.splice(i, 1); else S.disabled.push(s); persist(); },
  edNew() { Object.assign(S.set, { draft: BLANK[S.set.kind](), isNew: true, core: false, json: false, err: '' }); S.open = {}; S.modal = 'editor'; },
  edOpen(id) { const r = allEntries(S.set.kind).find(x => x.e.id === id); Object.assign(S.set, { draft: clone(r.e), isNew: false, core: !r.user, json: false, err: '' }); S.open = {}; S.modal = 'editor'; },
  edCopy(id) { const r = allEntries(S.set.kind).find(x => x.e.id === id), d = clone(r.e); d.id = ''; d.name += ' (copy)'; d.source = 'Homebrew'; Object.assign(S.set, { draft: d, isNew: true, core: false, json: false, err: '' }); S.open = {}; S.modal = 'editor'; },
  edDelete(id) { const r = allEntries(S.set.kind).find(x => x.e.id === id); S.modal = { confirm: r.over ? `Revert ${r.e.name} to the built-in version?` : `Delete ${r.e.name}?`, yes: r.over ? 'Revert' : 'Delete', danger: true, then() { S.user[S.set.kind] = S.user[S.set.kind].filter(x => x.id !== id); persist(); S.set.msg = (r.over ? 'Reverted ' : 'Deleted ') + r.e.name + '.'; } }; },
  edToggle(p) { const [path, v] = p.split('|'); const { obj, key } = resolve(path); const l = obj[key], i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); },
  edAdd(p) { const [path, k] = p.split('|'); const { obj, key } = resolve(path); obj[key].push(TEMPLATES[k](obj[key])); S.open = S.open || {}; S.open[`${path}.${obj[key].length - 1}`] = true; },
  edRemove(p) { const [path, i] = p.split('|'); const { obj, key } = resolve(path); obj[key].splice(+i, 1); },
  edJson() { const st = S.set; st.err = ''; if (!st.json) { st.jsonText = JSON.stringify(st.draft, null, 2); st.json = true; } else { try { st.draft = JSON.parse(st.jsonText); st.json = false; } catch (e) { st.err = 'JSON problem: ' + e.message; } } },
  edSave() {
    const st = S.set;
    if (st.json) { try { st.draft = JSON.parse(st.jsonText); } catch (e) { st.err = 'JSON problem: ' + e.message; return; } }
    const d = st.draft; if (!d.name || !d.name.trim()) { st.err = 'Give it a name.'; return; }
    if (!d.id) d.id = 'hb-' + (d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid().slice(0, 6));
    if (st.isNew && allEntries(st.kind).some(r => r.e.id === d.id)) { st.err = `The id '${d.id}' is already used. Change the Id field.`; return; }
    const list = S.user[st.kind] = (S.user[st.kind] || []).filter(x => x.id !== d.id); list.push(d); persist();
    st.msg = `Saved ${d.name}.`; S.modal = null; st.draft = null;
  },
  exportContent() { S.modal = { title: 'Export my content', json: JSON.stringify(S.user, null, 2) }; }
};

// ---------- events ----------
root.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
  if (t.dataset.self && e.target !== t) return;
  if (t.tagName === 'INPUT') return; // checkbox actions handled on change
  if (t.closest('summary')) e.preventDefault();
  const act = t.dataset.act, arg = t.dataset.a;
  let res;
  if (act.startsWith('setUses:')) { const i = +act.split(':')[1], f = cur().features[i], n = +arg; f.usesSpent = f.usesSpent === n ? n - 1 : n; save(); }
  else if (act.startsWith('setSlot:')) { const i = +act.split(':')[1], c = cur(), n = +arg; c.slotsExpended[i] = Math.min(c.slotsTotal[i], c.slotsExpended[i] === n ? n - 1 : n); save(); }
  else if (A[act]) res = A[act](arg);
  if (res !== 'norender') render();
});
root.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act === 'toggleSource') { A.toggleSource(el.dataset.a); render(); return; }
  if (el.dataset.pick) { S.pick[el.dataset.pick] = el.value; return; }
  if (el.dataset.file) { readFile(el); return; }
  if (el.dataset.search) return;
  if (el.dataset.poolexpr) {
    const text = el.value; S.pool.text = text;
    if (!text.trim()) { S.pool.dice = {}; S.pool.mod = 0; S.pool.err = ''; }
    else { const res = parsePool(text); if (res.pool) { S.pool.dice = res.pool.dice; S.pool.mod = res.pool.mod; syncPool(); } else S.pool.err = res.error; }
    renderSoon(); return;
  }
  if (el.dataset.f) { bindChange(el); renderSoon(); }
});
// Typing never re-renders the page: replacing a field mid-word breaks phone keyboards
// (their autocorrect re-inserts the word, e.g. "WWeWesWest").
root.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.search) {
    S.set.search = el.value; const q = el.value.toLowerCase();
    root.querySelectorAll('tr[data-text]').forEach(tr => { tr.hidden = !!q && !tr.dataset.text.includes(q); });
  }
});
// A change event fires when a field loses focus, often on the press of a button. Re-rendering then
// would swap the button out from under the press and swallow the click, so wait until it is released.

document.addEventListener('pointerdown', () => { pointerDown = true; }, true);
document.addEventListener('pointerup', () => { pointerDown = false; if (pendingRender) setTimeout(() => { if (pendingRender) render(); }, 0); }, true);
function renderSoon() { if (pointerDown) pendingRender = true; else render(); }
root.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.open) { S.open = S.open || {}; S.open[d.dataset.open] = d.open; } }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.modal) { S.modal = null; render(); } });
function readFile(el) {
  const file = el.files && el.files[0]; if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const data = JSON.parse(fr.result);
      if (el.dataset.file === 'char') { if (!data.scores) throw new Error("that file isn't a character"); data.id = uid(); S.chars.push(Object.assign(newChar(), data)); persist(); }
      else { let n = 0; KINDS.forEach(([k]) => (data[k] || []).forEach(en => { if (!en.id) en.id = uid().slice(0, 8); S.user[k] = (S.user[k] || []).filter(x => x.id !== en.id); S.user[k].push(en); n++; })); persist(); S.set.msg = `Imported ${n} entries.`; }
    } catch (err) { S.set.msg = "Couldn't import: " + err.message; }
    render();
  };
  fr.readAsText(file);
}

// ---------- boot ----------
S.user = Object.assign(emptyLib(), store.get('vs.content') || {});
S.disabled = store.get('vs.disabled') || [];
S.chars = store.get('vs.chars') || [];
if (!S.chars.length) { S.chars = [exampleCharacter()]; }
S.charId = S.chars[0].id;
d20('Perception check', skB(C(), 'Perception'));
render();
})();
