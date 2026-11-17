# Vocab Hero content guide

Authored vocabulary lives in `src/content/grades/gradeN.json` (one pack per grade, 2–9).
The TypeScript schema is `src/content/schema.ts`. Validate with:

```bash
node scripts/validate-content.mjs
```

All content is **original**, marked `"review": "pending"` until a person has edited it, and is not
curriculum-certified. Grade labels describe approximate difficulty only.

## Rules for every word entry

- `id`: `word.pos.sense` using `noun | verb | adj | adv`, e.g. `reluctant.adj.1`. Separate senses get separate entries.
- `say`: a simple respelling with the stressed syllable in capitals (`rih-LUK-tunt`).
- `definition`: one short child-friendly sentence fragment for the grade. Original wording, not copied from a dictionary.
- `hero`: a superhero example sentence + a `scene` (pose / props / setting) that shows the meaning. The academy's heroes are
  Nova, Bolt, Pixel, Juniper, Rex, and Kai — use them in hero sentences.
- `everyday`: an example **outside** the superhero setting (school, home, nature, science, history, art, sport, etc.).
- `contrast`: a plausible **non-example** and a short explanation of the defining feature, with its own `scene`.
- `related`: `synonyms`, `antonyms`, `family` (other forms: reluctance, reluctantly). Arrays may be empty but must exist.
- `forms`: every inflected form accepted in typed recall, including the base word.
- `parts` (optional): prefix / root / suffix meanings when they really help with *this* word.
- `tags`: subject areas (`reading`, `science`, `history`, `arts`, `math`, `social`, `everyday`).
- `items`: **5 practice items** spanning **at least 3 formats**:
  1. one `supported` item (simple, scaffolded; usually `meaning` or `example_nonexample`) — used right after teaching;
  2. two or three `independent` items in a **new context** (not the teaching sentences);
  3. at least one `transfer` item: a fresh situation with a fresh set of options, held for later missions.
  Include one `sentence_build` per word where reasonable.

### Formats

| format | shape | notes |
|---|---|---|
| `meaning` | prompt + 4 options (`a`–`d`) | Choose the best definition for the word *as used* in `passage`, or "which person is X?" |
| `context_gap` | `passage` contains `___`, 4 word options | Explanation names the clue words; put them in `clue`. |
| `example_nonexample` | `passage` describes a situation; options exactly `[{"id":"yes","text":"Yes, it fits"},{"id":"no","text":"No, it doesn't fit"}]` | Explanation names the defining feature. Mix yes and no answers across words. |
| `synonym` | sentence in `passage`, ask for closest meaning **or** opposite in that sentence | Explain strength/sense differences. |
| `context_clues` | short passage using the word (or a description), ask what it means / which word fits | Explanation quotes the evidence. |
| `sentence_build` | `chunks` (4–6, ids `c1`…), `answer` = ordered chunk ids | Must include 1–2 **decoy chunks** that make a sentence that misuses the word, so the child makes a meaning choice, not just a word-order choice. |
| `best_word` | choose between nearby meanings (annoyed vs furious) | Explain degree / tone. |
| `word_parts` | use a prefix/suffix/root to work out meaning | Explain the part in this actual word. |
| `dialogue` | choose the line that uses the word naturally | Explain meaning and usage. |

`recall` and `scene_choice` items are generated automatically from the entry — do not author them.

### Distractors

- Plausible but clearly wrong for the supplied context. No accidentally valid answers.
- In `context_gap`, every option must fit the sentence **grammatically** (same part of speech and form). Avoid `a ___` / `an ___` before the gap.
- The correct option must **not** usually be the longest. Vary which position (`a`–`d`) holds the answer; the app shuffles too.
- `explanation` explains the intended sense for both right and wrong answers. `wrong` may give targeted feedback per option id.
- Do not make every context about combat. Use school, family, science, history, art, sport, nature, cooking, music, community.

### Grade calibration

Lower grades: short sentences (8–14 words), concrete situations, obviously different distractors.
Higher grades: longer sentences and short paragraphs, abstract contexts (argument, history, science, literature),
subtler distractors that differ in nuance or tone. Avoid obscure trivia words.

## Worked example

```json
{
  "id": "reluctant.adj.1",
  "word": "reluctant",
  "grade": 4,
  "pos": "adjective",
  "say": "rih-LUK-tunt",
  "definition": "hesitant or not wanting to do something",
  "hero": {
    "text": "Nova was reluctant to cross the shaky bridge, but she knew someone needed help on the other side.",
    "scene": { "pose": "hesitant", "props": ["🌉", "😟"], "setting": "city" }
  },
  "everyday": "Mia was reluctant to speak in front of the class.",
  "contrast": {
    "nonExample": "Sam can't swim yet, so he stays out of the pool.",
    "explanation": "Being unable to do something is different from being reluctant. Someone may be able to swim but still be reluctant to get into cold water.",
    "scene": { "pose": "excited", "props": ["🏊", "💦"], "setting": "park" }
  },
  "related": { "synonyms": ["hesitant", "unwilling"], "antonyms": ["eager", "willing"], "family": ["reluctance", "reluctantly"] },
  "forms": ["reluctant"],
  "tags": ["reading", "everyday"],
  "items": [
    {
      "id": "reluctant.adj.1#1", "format": "meaning", "stage": "supported",
      "prompt": "Which person is reluctant?",
      "options": [
        { "id": "a", "text": "Ava runs over to join the game right away." },
        { "id": "b", "text": "Leo hangs back because he doesn't want to join." },
        { "id": "c", "text": "Zoe cheers loudly for her team." }
      ],
      "answer": "b",
      "hint": "Look for the person who does not want to do something.",
      "explanation": "Reluctant means hesitant or unwilling. Leo hangs back because he doesn't want to join.",
      "wrong": { "a": "Ava wants to join immediately, so eager fits her better.", "c": "Zoe is excited, not hesitant." }
    },
    {
      "id": "reluctant.adj.1#2", "format": "context_gap", "stage": "independent",
      "prompt": "Choose the word that best completes the sentence.",
      "passage": "Although he knew how to swim, Ben was ___ to jump into the icy lake.",
      "options": [
        { "id": "a", "text": "delighted" }, { "id": "b", "text": "ordinary" },
        { "id": "c", "text": "reluctant" }, { "id": "d", "text": "generous" }
      ],
      "answer": "c",
      "clue": "Although he knew how; icy",
      "hint": "\"Although\" tells you something unexpected is coming. How might someone feel about icy water?",
      "explanation": "\"Although he knew how to swim\" shows Ben was able, and \"icy\" shows why he hesitated. Reluctant fits: he did not want to jump."
    },
    {
      "id": "reluctant.adj.1#3", "format": "synonym", "stage": "independent",
      "prompt": "Which word is closest in meaning to \"reluctant\" in this sentence?",
      "passage": "The puppy was reluctant to step onto the slippery floor.",
      "options": [
        { "id": "a", "text": "unwilling" }, { "id": "b", "text": "unable" },
        { "id": "c", "text": "excited" }, { "id": "d", "text": "careless" }
      ],
      "answer": "a",
      "hint": "Did the puppy not want to, or could it not?",
      "explanation": "Unwilling means not wanting to, which matches reluctant. Unable means it couldn't, which is a different idea."
    },
    {
      "id": "reluctant.adj.1#4", "format": "sentence_build", "stage": "independent",
      "prompt": "Build a sentence that shows what reluctant means.",
      "chunks": [
        { "id": "c1", "text": "Priya was reluctant" },
        { "id": "c2", "text": "to share her new markers," },
        { "id": "c3", "text": "but she handed one to her friend." },
        { "id": "c4", "text": "so she happily gave them all away." }
      ],
      "answer": ["c1", "c2", "c3"],
      "hint": "A reluctant person hesitates. Which ending shows hesitation and then a choice?",
      "explanation": "Reluctant people hesitate, so \"but she handed one to her friend\" fits. \"Happily gave them all away\" shows eagerness, not reluctance."
    },
    {
      "id": "reluctant.adj.1#5", "format": "context_clues", "stage": "transfer",
      "prompt": "Which word best describes how Lena felt?",
      "passage": "Lena eventually agreed to lend out her favorite book, but she hesitated for a long time first.",
      "options": [
        { "id": "a", "text": "proud" }, { "id": "b", "text": "reluctant" },
        { "id": "c", "text": "curious" }, { "id": "d", "text": "furious" }
      ],
      "answer": "b",
      "clue": "hesitated for a long time",
      "hint": "What does hesitating before agreeing tell you?",
      "explanation": "\"Hesitated for a long time\" before agreeing shows Lena didn't really want to. That is reluctant. Furious is much stronger anger, and nothing shows she was angry."
    }
  ],
  "review": "pending"
}
```
