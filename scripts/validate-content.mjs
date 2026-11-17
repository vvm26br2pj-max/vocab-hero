#!/usr/bin/env node
// Validate (and optionally merge) vocabulary grade packs.
// Usage:
//   node scripts/validate-content.mjs            -> validate all src/content/grades/grade*.json
//   node scripts/validate-content.mjs merge 4    -> merge src/content/grades/parts/grade4-*.json into grade4.json, then validate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gradesDir = path.join(root, 'src/content/grades');
const partsDir = path.join(gradesDir, 'parts');

const POSES = ['neutral','happy','excited','sad','angry','scared','surprised','thinking','hesitant','confident','tired','calm','proud','confused','determined','kind','sneaky','looking','pointing','lifting','running','jumping','flying','sitting','talking','listening','writing','building','waving','shrugging'];
const SETTINGS = ['city','school','park','lab','home','sky','street','stage','nature','night'];
const AUTHORED_FORMATS = ['meaning','context_gap','example_nonexample','synonym','context_clues','sentence_build','best_word','word_parts','dialogue'];
const POS = ['noun','verb','adjective','adverb'];
const META = {
  2: ['Grade 2', 'Familiar actions, feelings, and concrete descriptions'],
  3: ['Grade 3', 'Describing behavior and everyday situations'],
  4: ['Grade 4', 'More precise descriptions, motives, and explanations'],
  5: ['Grade 5', 'Flexible meanings and common academic language'],
  6: ['Grade 6', 'Reasoning, word parts, and shades of meaning'],
  7: ['Grade 7', 'Abstract ideas and more precise argument'],
  8: ['Grade 8', 'Nuance, tone, and stronger academic language'],
  9: ['Grade 9', 'Advanced nuance, rhetoric, and abstract concepts'],
};

const args = process.argv.slice(2);
if (args[0] === 'merge') {
  const g = Number(args[1]);
  const files = fs.readdirSync(partsDir).filter((f) => f.startsWith(`grade${g}-`) && f.endsWith('.json')).sort();
  const words = [];
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'));
    words.push(...(Array.isArray(data) ? data : data.words));
  }
  const pack = { grade: g, title: META[g][0], emphasis: META[g][1], words };
  fs.writeFileSync(path.join(gradesDir, `grade${g}.json`), JSON.stringify(pack, null, 1));
  console.log(`Merged ${files.length} part files, ${words.length} words -> grade${g}.json`);
}

let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log('  ERROR ' + m); };
const warn = (m) => { warnings++; console.log('  warn  ' + m); };
const allWords = new Map();

function checkScene(s, where) {
  if (!s || typeof s !== 'object') return err(`${where}: missing scene`);
  if (!POSES.includes(s.pose)) err(`${where}: bad pose "${s.pose}"`);
  if (s.second && !POSES.includes(s.second)) err(`${where}: bad second pose "${s.second}"`);
  if (!SETTINGS.includes(s.setting)) err(`${where}: bad setting "${s.setting}"`);
  if (!Array.isArray(s.props) || s.props.length > 3) err(`${where}: props must be array of <=3 emoji`);
}

const packFiles = fs.readdirSync(gradesDir).filter((f) => /^grade\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
for (const f of packFiles) {
  console.log(`== ${f}`);
  let pack;
  try { pack = JSON.parse(fs.readFileSync(path.join(gradesDir, f), 'utf8')); } catch (e) { err(`invalid JSON: ${e.message}`); continue; }
  if (!Array.isArray(pack.words)) { err('words must be an array'); continue; }
  if (pack.words.length < 40) warn(`only ${pack.words.length} words (target 40)`);
  let longestCorrect = 0, mcCount = 0;
  const positionCounts = {};
  const ids = new Set();
  for (const w of pack.words) {
    const W = `${w.id ?? '?'}`;
    for (const k of ['id','word','grade','pos','say','definition','hero','everyday','contrast','related','forms','tags','items','review']) if (w[k] === undefined) err(`${W}: missing ${k}`);
    if (ids.has(w.id)) err(`${W}: duplicate id`); ids.add(w.id);
    if (allWords.has(w.word?.toLowerCase())) err(`${W}: word also appears in ${allWords.get(w.word.toLowerCase())}`);
    allWords.set(w.word?.toLowerCase(), f);
    if (!/^[a-z-]+\.(noun|verb|adj|adv)\.\d+$/.test(w.id || '')) err(`${W}: id must look like word.adj.1`);
    if (w.grade !== pack.grade) err(`${W}: grade ${w.grade} != pack ${pack.grade}`);
    if (!POS.includes(w.pos)) err(`${W}: bad pos ${w.pos}`);
    if (w.hero) { if (!w.hero.text) err(`${W}: hero.text`); checkScene(w.hero.scene, `${W} hero`); }
    if (w.contrast) { if (!w.contrast.nonExample || !w.contrast.explanation) err(`${W}: contrast text`); checkScene(w.contrast.scene, `${W} contrast`); }
    if (w.related) for (const k of ['synonyms','antonyms','family']) if (!Array.isArray(w.related[k])) err(`${W}: related.${k} must be array`);
    if (Array.isArray(w.forms) && !w.forms.map((x) => x.toLowerCase()).includes(w.word?.toLowerCase())) err(`${W}: forms must include base word`);
    if (!Array.isArray(w.items)) continue;
    if (w.items.length < 4) err(`${W}: needs >=4 items (has ${w.items.length})`);
    const formats = new Set(w.items.map((i) => i.format));
    if (formats.size < 3) err(`${W}: items must span >=3 formats`);
    const stages = new Set(w.items.map((i) => i.stage));
    for (const s of ['supported','independent','transfer']) if (!stages.has(s)) err(`${W}: needs at least one ${s} item`);
    const itemIds = new Set();
    for (const it of w.items) {
      const I = `${it.id}`;
      if (!it.id?.startsWith(w.id + '#')) err(`${I}: item id must start with ${w.id}#`);
      if (itemIds.has(it.id)) err(`${I}: duplicate item id`); itemIds.add(it.id);
      if (!AUTHORED_FORMATS.includes(it.format)) err(`${I}: bad format ${it.format}`);
      if (!['supported','independent','transfer'].includes(it.stage)) err(`${I}: bad stage`);
      if (!it.prompt || !it.hint || !it.explanation) err(`${I}: prompt/hint/explanation required`);
      if (it.format === 'context_gap' && !(it.passage || '').includes('___')) err(`${I}: context_gap passage needs ___`);
      if (it.format === 'sentence_build') {
        if (!Array.isArray(it.chunks) || !Array.isArray(it.answer)) { err(`${I}: sentence_build needs chunks and array answer`); continue; }
        const cids = new Set(it.chunks.map((c) => c.id));
        if (it.answer.some((a) => !cids.has(a))) err(`${I}: answer references unknown chunk`);
        if (it.chunks.length <= it.answer.length) err(`${I}: needs at least one decoy chunk (semantic choice)`);
        continue;
      }
      if (!Array.isArray(it.options)) { err(`${I}: options required`); continue; }
      const oids = it.options.map((o) => o.id);
      if (new Set(oids).size !== oids.length) err(`${I}: duplicate option ids`);
      if (!oids.includes(it.answer)) err(`${I}: answer "${it.answer}" not in options`);
      if (it.format === 'example_nonexample') {
        if (oids.join(',') !== 'yes,no') err(`${I}: example_nonexample options must be [yes,no]`);
        continue;
      }
      if (it.options.length < 3 || it.options.length > 4) err(`${I}: need 3-4 options`);
      mcCount++;
      const correct = it.options.find((o) => o.id === it.answer);
      if (correct) {
        const others = it.options.filter((o) => o.id !== it.answer);
        if (others.every((o) => correct.text.length > o.text.length + 3)) longestCorrect++;
        positionCounts[oids.indexOf(it.answer)] = (positionCounts[oids.indexOf(it.answer)] || 0) + 1;
        if (it.format === 'context_gap') {
          const m = (it.passage || '').match(/\b(a|an)\s+___/i);
          if (m) warn(`${I}: "${m[0]}" may cue the answer by grammar`);
        }
      }
    }
  }
  if (mcCount > 0 && longestCorrect / mcCount > 0.4) warn(`correct option is the longest in ${longestCorrect}/${mcCount} items (keep under 40%)`);
  console.log(`  ${pack.words.length} words, ${mcCount} multiple-choice items; correct-is-longest ${longestCorrect}`);
}
console.log(`\n${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
