import type { PartOfSpeech, PracticeItem, WordEntry } from '../content/schema';
import { shuffle } from './mission';

export interface ImportRow { line: number; word: string; pos: PartOfSpeech | ''; definition: string; example1: string; example2: string; issues: string[]; warnings: string[] }

const POS_MAP: Record<string, PartOfSpeech> = { noun: 'noun', n: 'noun', verb: 'verb', v: 'verb', adjective: 'adjective', adj: 'adjective', adverb: 'adverb', adv: 'adverb' };

/**
 * Parse a parent word list. One word per line:  word | part of speech | definition | example sentence | second example (optional)
 * Tabs or commas also work as separators when no "|" is present.
 */
export function parseWordList(text: string, existingWords: Set<string>): ImportRow[] {
  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const sep = line.includes('|') ? '|' : line.includes('\t') ? '\t' : ',';
    const [word = '', pos = '', definition = '', example1 = '', example2 = ''] = line.split(sep).map((s) => s.trim());
    const w = word.toLowerCase();
    const row: ImportRow = { line: i + 1, word: w, pos: POS_MAP[pos.toLowerCase()] ?? '', definition, example1, example2, issues: [], warnings: [] };
    if (!/^[a-z][a-z'-]*$/.test(w)) row.issues.push('Word should be a single word (letters only).');
    if (!row.pos) row.issues.push('Part of speech missing or unclear (noun, verb, adjective, adverb).');
    if (definition.length < 4) row.issues.push('Definition missing.');
    if (!example1) row.issues.push('Example sentence missing.');
    else if (!example1.toLowerCase().includes(w.slice(0, Math.max(3, w.length - 3)))) row.issues.push('Example sentence does not seem to use the word.');
    if (!example2) row.warnings.push('No second example: the word can be practiced but cannot reach Secure without a fresh context.');
    if (seen.has(w)) row.issues.push('Listed twice. If it has two meanings, give each line a different definition and review carefully.');
    if (existingWords.has(w)) row.warnings.push('Already in a built-in pack; the parent version will be practiced as a separate entry.');
    if (definition && definition.toLowerCase().split(/\W+/).includes(w)) row.warnings.push('Definition uses the word itself.');
    seen.add(w);
    rows.push(row);
  });
  return rows;
}

function blank(sentence: string, word: string): string | null {
  const re = new RegExp(`\\b${word.slice(0, Math.max(3, word.length - 3))}[a-z]*\\b`, 'i');
  return re.test(sentence) ? sentence.replace(re, '___') : null;
}

/** Build a practice-ready entry from a reviewed row. distractors: other entries for wrong options. */
export function buildCustomEntry(row: ImportRow, pool: WordEntry[], n: number, rng = Math.random): WordEntry {
  const id = `${row.word}.${row.pos === 'adjective' ? 'adj' : row.pos === 'adverb' ? 'adv' : row.pos}.c${n}`;
  const others = shuffle(pool.filter((w) => w.word !== row.word && w.definition), rng);
  const samePos = others.filter((w) => w.pos === row.pos);
  const defs = (samePos.length >= 3 ? samePos : others).slice(0, 3);
  // distractor words for gap items: same part of speech when there are enough, never reusing the definition distractors
  const wordPool = samePos.length >= 6 ? samePos : others;
  const words = wordPool.filter((w) => !defs.includes(w)).slice(0, 3);
  const items: PracticeItem[] = [];
  const opts = shuffle([{ id: 'a', text: row.definition }, ...defs.map((d, i) => ({ id: 'bcd'[i], text: d.definition }))], rng);
  items.push({ id: `${id}#1`, format: 'meaning', stage: 'supported', prompt: `What does “${row.word}” mean?`, options: opts, answer: 'a',
    hint: `Think about this sentence: ${row.example1}`, explanation: `“${row.word}” means ${row.definition}.` });
  const gap1 = blank(row.example1, row.word);
  if (gap1 && words.length === 3) items.push({ id: `${id}#2`, format: 'context_gap', stage: 'independent', prompt: 'Choose the word that best completes the sentence.', passage: gap1,
    options: shuffle([{ id: 'a', text: row.word }, ...words.map((w, i) => ({ id: 'bcd'[i], text: w.word }))], rng), answer: 'a',
    hint: `Which word means “${row.definition}”?`, explanation: `“${row.word}” (${row.definition}) fits this sentence.` });
  const gap2 = row.example2 ? blank(row.example2, row.word) : null;
  if (gap2 && words.length === 3) items.push({ id: `${id}#3`, format: 'context_gap', stage: 'transfer', prompt: 'Choose the word that best completes the sentence.', passage: gap2,
    options: shuffle([{ id: 'a', text: row.word }, ...words.map((w, i) => ({ id: 'bcd'[i], text: w.word }))], rng), answer: 'a',
    hint: `Which word means “${row.definition}”?`, explanation: `“${row.word}” (${row.definition}) fits this new sentence too.` });
  return {
    id, word: row.word, grade: 0, pos: row.pos as PartOfSpeech, say: row.word, definition: row.definition,
    hero: { text: row.example1, scene: { pose: 'thinking', props: ['📝'], setting: 'school' } },
    everyday: row.example1,
    contrast: { nonExample: '', explanation: '', scene: { pose: 'shrugging', props: [], setting: 'school' } },
    related: { synonyms: [], antonyms: [], family: [] }, forms: [row.word], tags: ['parent'], items, review: 'pending',
  };
}
