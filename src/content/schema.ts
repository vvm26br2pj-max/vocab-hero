// Vocabulary content schema. Authored data lives in src/content/grades/*.json.
// See CONTENT_GUIDE.md for authoring rules. Keep this file and scripts/validate-content.mjs in sync.

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb';

/** Poses the scene renderer knows how to draw. */
export const POSES = [
  'neutral', 'happy', 'excited', 'sad', 'angry', 'scared', 'surprised', 'thinking',
  'hesitant', 'confident', 'tired', 'calm', 'proud', 'confused', 'determined', 'kind',
  'sneaky', 'looking', 'pointing', 'lifting', 'running', 'jumping', 'flying', 'sitting',
  'talking', 'listening', 'writing', 'building', 'waving', 'shrugging',
] as const;
export type Pose = (typeof POSES)[number];

export const SETTINGS = ['city', 'school', 'park', 'lab', 'home', 'sky', 'street', 'stage', 'nature', 'night'] as const;
export type SceneSetting = (typeof SETTINGS)[number];

export interface SceneSpec {
  pose: Pose;
  /** Up to 3 emoji props placed around the hero. */
  props: string[];
  /** Optional second character and their pose. */
  second?: Pose;
  setting: SceneSetting;
}

export type Format =
  | 'meaning'            // meaning match: choose the best definition / sense
  | 'context_gap'        // complete a sentence
  | 'example_nonexample' // yes/no: does this situation fit the word?
  | 'synonym'            // synonym or antonym in a specific sentence
  | 'context_clues'      // infer meaning/word from a passage, identify evidence
  | 'sentence_build'     // arrange chunks with a semantic choice
  | 'best_word'          // choose between nearby meanings
  | 'word_parts'         // use prefix/suffix/root
  | 'dialogue'           // choose the line using the word naturally
  | 'recall'             // type the word from a clue (auto-generated)
  | 'scene_choice';      // choose the illustration (auto-generated)

export type Stage = 'supported' | 'independent' | 'transfer';

export interface Option { id: string; text: string; }

export interface PracticeItem {
  /** Stable ID: `${wordId}#${n}` */
  id: string;
  format: Format;
  /** supported = scaffolded first question; independent = new context; transfer = held for a later mission */
  stage: Stage;
  prompt: string;
  /** Optional passage / sentence shown above the prompt. Use ___ for a gap. */
  passage?: string;
  /** Multiple-choice options with stable ids "a".."d". For example_nonexample use ids "yes" and "no". */
  options?: Option[];
  /** For sentence_build: chunks with stable ids; includes 1-2 decoy chunks. */
  chunks?: Option[];
  /** Option id, or ordered chunk ids for sentence_build. */
  answer: string | string[];
  hint: string;
  /** Shown after every attempt (correct or not): explains the intended sense and the clue. */
  explanation: string;
  /** Optional targeted feedback per wrong option id. */
  wrong?: Record<string, string>;
  /** Clue words in the passage to highlight in feedback. */
  clue?: string;
}

export interface WordEntry {
  /** Stable word-and-sense id, e.g. "reluctant.adj.1" */
  id: string;
  word: string;
  grade: number;
  pos: PartOfSpeech;
  /** Simple respelling, e.g. "rih-LUK-tunt" */
  say: string;
  definition: string;
  hero: { text: string; scene: SceneSpec };
  everyday: string;
  contrast: { nonExample: string; explanation: string; scene: SceneSpec };
  related: { synonyms: string[]; antonyms: string[]; family: string[] };
  /** Accepted inflected forms for typed recall, including the base word. */
  forms: string[];
  /** Optional word-part breakdown. */
  parts?: { part: string; meaning: string }[];
  /** Subject area tags: reading, science, history, arts, math, social, everyday */
  tags: string[];
  items: PracticeItem[];
  review: 'pending' | 'reviewed';
}

export interface GradePack {
  grade: number;
  title: string;
  emphasis: string;
  words: WordEntry[];
}
