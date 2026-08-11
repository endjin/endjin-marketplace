# The rulebook

Original guidance for clear technical writing. Every example is a software example.
Rules are numbered for reference from the checker and the domain guides.

## 1. Words

**W1 — Prefer the short, common word.** Long words add formality, not meaning, and they
slow down non-native readers. See `word-choices.md` for the substitution list.
- Weak: "Utilize the CLI to instantiate the environment prior to commencement of testing."
- Clear: "Use the CLI to create the environment before you start testing."

**W2 — One name per concept.** Pick one term for each system, component, and action, and
use it everywhere. Synonym variety reads as a distinction the reader must decode: if one
paragraph says "job" and the next says "task", the reader assumes they differ.
- Weak: "Submit the job. When the task completes, the workflow output appears in S3."
- Clear: "Submit the job. When the job completes, its output appears in S3."

**W3 — Expand abbreviations at first use.** Write "single sign-on (SSO)" once, then use
"SSO". Skip the expansion only for abbreviations more common than their expansion (API,
URL, SQL). Never invent an abbreviation to save keystrokes.

**W4 — No Latin abbreviations.** "e.g." → "for example". "i.e." → "that is". "etc." →
"and so on", or rewrite the list so it does not trail off. "via" → "through" or "with".

**W5 — Concrete values beat vague qualifiers.** Words like "significantly", "robust",
"seamless", "performant", "very" claim without informing. Give the number, the limit, or
the behavior.
- Weak: "The new parser is significantly faster and more robust."
- Clear: "The new parser processes 50 MB files in 3 seconds (previously 40 seconds) and
  recovers from malformed rows instead of stopping."

**W6 — Keep noun chains short.** Three nouns/modifiers at most. Longer chains hide which
word modifies which. Break them with "of", "for", or a clause.
- Weak: "the customer order event stream schema registry entry"
- Clear: "the schema-registry entry for the customer-order event stream"

**W7 — Define terms of art once, in a glossary or at first use.** Domain terms
(idempotent, backfill, cardinality) are welcome when your audience shares them; define
them when any intended reader might not.

**W8 — Spell consistently.** Pick one English variant (US or UK) per document set and
stay with it. Never respell quoted output, identifiers, or API names.

## 2. Sentences

**S1 — One idea per sentence.** A sentence that carries two ideas forces the reader to
hold both; split it. Coordinating chains ("and... and... which... so...") are the
symptom.

**S2 — Length limits.** Instructions: at most 20 words. Description: at most 25 words.
These are ceilings, not targets — most good sentences are far shorter. When counting,
treat a number with its unit, a hyphenated group, code in backticks, and a parenthetical
aside as one word each.

**S3 — Do not amputate sentences.** Dropping articles, subjects, and verbs makes text
terse, not clear. "Restart service if unhealthy" → "If the service is unhealthy, restart
it." Telegraphic style is acceptable only in tables and diagrams.

**S4 — No semicolons.** A semicolon joins two sentences that would be clearer apart.
Write two sentences. (Semicolons in code are code.)

**S5 — Vertical lists for enumerations.** Three or more parallel items belong in a list,
not a comma chain. Lead in with a full sentence and a colon. Keep items grammatically
parallel. End full-sentence items with periods; leave fragment items bare; never mix the
two styles in one list.

**S6 — Connect sentences deliberately.** Use "then", "as a result", "but", "for
example", "in contrast" to signal how a sentence relates to the previous one. In
description, repeat the key noun instead of reaching for a pronoun whose antecedent is
ambiguous. If "it" or "this" could point at two things, replace it with the noun.

## 3. Verbs and voice

**V1 — Active voice, named agent.** The actor comes first: "The controller restarts
failed pods", not "Failed pods are restarted". Passive hides who acts, and in operations
documents that ambiguity becomes an incident.
Passive is acceptable when the actor is genuinely unknown or irrelevant: "The record was
corrupted during transmission."

**V2 — Simple tenses only.** Present ("the cache expires"), past ("the job failed"),
future ("the migration will run"). Rewrite perfect and progressive forms: "has been
deprecated" → "is deprecated (since v2.1)"; "is running" → "runs" or state the time.

**V3 — Verbs, not nominalizations.** "Perform an evaluation of" → "evaluate". "Make a
recommendation" → "recommend". The action lives in the verb; burying it in a noun adds
words and hides the actor.

**V4 — Imperative for instructions.** "Run the tests", not "The tests should be run" or
"You may want to run the tests". If a step is optional, say when it applies: "If you
changed the schema, run the migration."

**V5 — Condition before command.** The reader must know the condition before acting on
the command: "If the disk is full, delete the oldest snapshot" — never "Delete the
oldest snapshot if the disk is full", which invites action before the check.

## 4. Instructions (procedures, runbooks, how-tos)

**P1 — One action per step.** Number the steps. Combine actions in one step only when
they happen together ("Hold the reset button and reconnect power").

**P2 — State the expected result.** After an action whose outcome the reader must
verify, say what success looks like: "Run `make deploy`. The command prints the new
release ID."

**P3 — Limits live next to their action, not in notes.** A note is for helpful context
only. If skipping the note breaks the procedure, it is not a note — it is a step or a
warning.

**P4 — Write for the reader under stress.** Runbooks are read at 3 a.m. Front-load the
decision points, keep every sentence self-contained, and never require the reader to
remember something from three steps earlier — repeat it.

## 5. Description (overviews, ADRs, reports)

**D1 — Topic sentence first.** Each paragraph opens with the point; the rest of the
paragraph supports it. A reader who reads only first sentences should still get the
argument.

**D2 — One topic per paragraph, six sentences maximum.** New topic, new paragraph.

**D3 — Build gradually.** Introduce a system before its parts, a concept before its
exceptions. Do not make sentence one depend on a fact that arrives in sentence four.

**D4 — Facts, not adjectives.** "The queue is fast" tells the reader nothing they can
verify. "The queue delivers within 200 ms at p99" does.

## 6. Warnings and cautions

**N1 — Signal, command, consequence.** Risk word first (WARNING for harm to people,
CAUTION for damage to data, systems, or money), then the imperative command (condition
first if there is one), then what happens if ignored.
- "CAUTION: Do not run the backfill while the daily load runs. Concurrent writes corrupt
  the partition index."

**N2 — Match the level to the risk.** Do not inflate: a caution used for trivia teaches
readers to skip cautions. Do not deflate: data loss is never a "note".

## 7. Punctuation and mechanics

**M1 — Hyphenate compound modifiers** before a noun: "long-running query",
"three-node cluster". Do not hyphenate after the noun: "the query is long running".

**M2 — Parentheses** are for references ("(see §4)"), abbreviations ("(SSO)"), and short
asides. If the aside is a full sentence, it deserves to be one.

**M3 — Numbers.** Use numerals with units and in technical values (3 retries, 10 MB,
p95). Keep the unit with its number. ISO 8601 for dates (2026-08-11).

**M4 — Contractions.** Fine in UI text, tutorials, and informal docs. Avoid in
specifications, requirements, and legal-adjacent text.

**M5 — Quoted and fixed text is untouchable.** Error strings, log lines, UI labels,
config keys, code, and cited titles stay exactly as they are, in code formatting where
appropriate.
