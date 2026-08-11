---
name: clear-technical-writing
description: >-
  Write and rewrite clear, unambiguous, inclusive technical text for software teams:
  documentation, READMEs, API docs, runbooks, ADRs (architecture decision records),
  specifications, requirements, changelogs, release notes, error messages, UI text, commit
  messages, pipeline and data documentation, data dictionaries, incident reports, model
  cards, notebooks, and experiment reports. Use this skill whenever the user asks for
  clear, plain, simple, readable, consistent, standardized, or inclusive technical
  writing, wants text that non-native English readers can follow, or asks to review,
  tighten, or simplify any technical document — even if they do not name a standard.
---

# Clear technical writing

This skill applies a controlled writing discipline: short sentences, active voice, simple
verb forms, one term per concept, concrete values, and inclusive language. The goal is
text that every reader — including readers whose first language is not English — parses
correctly on the first read. The method is original to this skill and reproduces no
third-party rulebook or vocabulary. It draws on widely published plain-language and
inclusive-writing principles, including the Microsoft Style Guide's bias-free
communication guidance
(https://learn.microsoft.com/en-us/style-guide/bias-free-communication) and the GOV.UK
style guide (Open Government Licence v3.0).

Work in a loop: classify the text, draft against the rules, run the checker, fix, repeat.

## Workflow

1. **Classify the text.** Instructions (the reader does something) or description (the
   reader learns something)? Most documents mix both — classify each section, because
   the sentence rules differ. Then read the domain reference for your document type:
   - `references/app-development.md` — READMEs, API docs, ADRs, specifications,
     changelogs, error messages and UI text, commit messages.
   - `references/data-engineering.md` — pipeline documentation, runbooks, data
     dictionaries, incident reports.
   - `references/data-science.md` — model cards, notebooks, experiment reports,
     analysis write-ups.

2. **Read the rules.** `references/rules.md` is the full rulebook — sentence and
   paragraph construction, verbs and voice, word choice, procedures, descriptions,
   warnings, and punctuation. Read it before a large writing task; for a small edit the
   core rules below are usually enough.

3. **Draft.** Apply the core rules. For word-level decisions, consult
   `references/word-choices.md` (plain substitutions for inflated words and phrases) and
   `references/inclusive-language.md` (bias-free language: gender, disability, culture,
   and the modern replacements for exclusionary technical jargon).

4. **Check.** Run the bundled checker. The script lives in this skill's folder, so
   give the path from wherever you run it:

   ```
   python3 <path-to-this-skill>/scripts/check_writing.py DRAFT.md --type mixed   # or instructions / description
   ```

   It flags long sentences, passive voice, complex tenses, inflated words and phrases,
   vague qualifiers, non-inclusive terms, Latin abbreviations, and long noun chains.

5. **Fix and iterate.** Fix each finding or decide, deliberately, that it is justified
   (a domain term, a quoted string, an API name). Prefer rewriting a sentence over
   swapping one word. Re-run until the remaining findings are all deliberate.

## Core rules (always apply)

**Sentences.** One idea per sentence. Instructions: at most 20 words, imperative mood,
one action per sentence, condition before command ("If the build fails, read the log.").
Description: at most 25 words, subject-first, concrete. Paragraphs: one topic, topic
sentence first, at most six sentences.

**Verbs.** Active voice — name who or what acts ("The scheduler retries the job", not
"The job is retried"). Passive is acceptable only when the actor is unknown or
irrelevant. Use simple tenses (present, past, future). Avoid perfect and progressive
constructions ("has been running" → "runs" or "started at 09:00 and still runs").

**Words.** Choose the short, common word: use, not utilize; start, not commence; end,
not terminate. One name per concept — never alternate between "pipeline", "job", and
"workflow" for the same thing. Expand every abbreviation at first use. No Latin
abbreviations (e.g., i.e., etc. → for example, that is, and so on). Replace vague
qualifiers with values: not "significantly faster", but "p95 fell from 800 ms to
190 ms". Keep noun chains to three words or fewer; break longer ones with "of" or
"for".

**Inclusive language.** Gender-neutral wording (they, you, the operator — never a
default "he"). People-first disability language. No idioms or culture-bound metaphors
that fail in translation. Use the modern technical terms (allowlist, primary/replica,
placeholder data, stop responding) and diverse, neutral names in examples. See
`references/inclusive-language.md`.

**Requirements.** Use "must" and "must not" for obligations. Avoid "should" and "may"
unless you define them (for example, per RFC 2119) — undefined, they read as optional.
Every requirement names an agent: "The service must log each failed login."

**Warnings.** Risk word first (WARNING = harm to people, CAUTION = damage to data or
systems), then the command, then the consequence: "CAUTION: Back up the database before
you run the migration. A failed migration can corrupt the schema."

**Untouchable text.** Never alter code, commands, identifiers, API names, UI labels,
quoted output, or cited titles. Style rules apply to your prose, not to the artifacts
it describes.

## Judgment

- Clarity never outranks accuracy. If a rule would force you to drop a fact or blur a
  distinction, keep the fact and bend the rule as little as possible.
- Contractions are fine in UI text and informal docs; avoid them in specifications and
  requirements, where precision reads better slightly formal.
- House style and regulatory wording win over this skill's rules; apply everything else
  around them.
- When you rewrite existing text, present the result first, then note the two or three
  most important changes — not a full accounting.
