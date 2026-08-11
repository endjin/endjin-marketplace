---
name: ste-writing
description: >-
  Write and rewrite text in ASD-STE100 Simplified Technical English (STE, Issue 9) — the
  controlled language standard with 65 writing rules and a dictionary of 875 approved words.
  Use this skill whenever the user asks for STE, Simplified Technical English, controlled
  language, or "simplified English", and whenever they ask you to write or revise technical
  documentation, procedures, runbooks, READMEs, ADRs (architecture decision records),
  specifications, requirements, changelogs, release notes, user-facing messages, error
  messages, UI text, notes, or emails that must be clear, unambiguous, or easy for non-native
  English readers — even if they do not name STE explicitly but ask for "plain", "simple",
  "clear", or "standardized" technical writing.
---

# Write in Simplified Technical English (ASD-STE100 Issue 9)

STE is a controlled language. It has a dictionary of approved words and a set of writing
rules. STE makes sure that readers immediately know the meaning of each sentence. This
includes readers who do not have English as their first language.

Text is correct STE only when it obeys the rules and the dictionary. Thus, use this skill
as a loop: identify the text type, write, check, correct, and check again.

## Workflow

1. **Identify the text type.** Procedural text gives instructions that the reader must do.
   Descriptive text gives information. Most documents have the two types — identify the
   type of each section. Then read `references/document-types.md`. It tells you how to
   apply STE to each document type (documentation, ADR, specification, changelog, user
   message, note, commit message).

2. **Read the applicable rules.** The three rule files give the rules of part 1 of the
   standard in a short form. Read the files that are applicable to your task before you
   write:
   - `references/rules-words-verbs.md` — sections 1 thru 3: the dictionary, technical
     nouns and technical verbs (the categories that let you use domain words), multi-word
     nouns, approved verb forms, active voice.
   - `references/rules-sentences.md` — sections 4 thru 6: sentence construction, vertical
     lists, procedural rules (20-word limit, one instruction in each sentence, imperative
     form, condition first), descriptive rules (25-word limit, one topic in each sentence,
     paragraphs).
   - `references/rules-safety-punctuation.md` — sections 7 thru 9: warnings and cautions,
     punctuation, word count, writing practices, general recommendations.

3. **Write.** Apply the primary rules below. If you are not sure that a word is approved,
   look for the word in `references/words-approved.md` (approved words with meanings) and
   `references/words-unapproved.md` (words that are not approved, with approved
   alternatives). An approved word is correct only as the part of speech and with the
   meaning that the dictionary gives.

4. **Check.** Use the checker on your text:

   ```
   python3 scripts/check_ste.py DRAFT.md --type mixed   # or procedural / descriptive
   ```

   The checker finds words that are not approved (with their alternatives), sentences
   that are too long, semicolons, contractions, passive voice, complex tenses, Latin
   abbreviations, and "-ing" forms.

5. **Correct and make sure.** Correct each finding, or make sure that the finding is
   correct STE. For each word that is not in the dictionary, make sure that it is a
   technical noun or a technical verb for the domain (rules 1.5/1.12 — the categories are
   in `references/rules-words-verbs.md`). If it is not, replace it. A different sentence
   construction is frequently better than a word-for-word replacement (rule 9.1). Use the
   checker again until the only findings are technical terms that are correct for the
   domain.

## Primary rules (always apply)

**Words.** Use only these words:

- Approved dictionary words, as their approved part of speech and with their approved
  meaning
- Technical nouns — domain terms for parts, systems, software, units, and damage types
- Technical verbs — domain verbs such as "install", "click", and "deploy".

Use one name for one item — do not change between different names. Use American English
spelling. A multi-word noun can have a maximum of three words. Divide longer word chains
with "of", "for", or "that".

**Verbs.** Use only these forms: the infinitive, the imperative, the simple present, the
simple past, the simple future, and the past participle as an adjective. Do not use the
perfect or progressive tenses. Do not use "-ing" verb forms. Always use the active voice
(the passive voice is permitted only in descriptive text, and only when the agent is not
known). Frequent replacements:

- ensure → make sure that
- carry out / perform → do
- may / might → can
- should → must (or a new construction)
- a command with a condition → the condition first, then the command.

**Procedural sentences.** Use a maximum of 20 words in each sentence. Use the imperative
form. Write one instruction in each sentence, unless two or more actions occur at the same
time (rule 5.2). Put the condition first, then a comma, then the command: "If the light
comes on, disconnect the cable." Notes give information only — not instructions and not
limits.

**Descriptive sentences.** Use a maximum of 25 words in each sentence. Give each sentence
only one topic. Put the topic sentence first. Use a maximum of six sentences in each
paragraph. Be accurate: give the value, not "the value can change".

**Sentence quality.** Do not use semicolons or contractions. Write all the nouns, verbs,
subjects, and articles ("Set the switch to ON", not "Switch to ON"). Do not use Latin
abbreviations. Do not use the pronouns "he" and "she". Use "that" after verbs such as
"make sure" and "show".

**Safety instructions.** Give the risk level (WARNING = injury, CAUTION = damage), then
the command (condition first if necessary), then the risk: "CAUTION: Do a backup before
you do the upgrade. An upgrade that stops can cause damage to your data."

**Quoted text.** Do not change quoted text. Code, commands, flags, UI labels, placards,
titles, and formulas stay as they are. Each counts as one word.

## Decisions

- A rule is not a cause to remove information or precision. If a rule and precision do
  not agree, keep precision. Then obey the rule as much as possible.
- The dictionary shows its examples in uppercase letters only for display. Your text does
  not have to be uppercase.
- If official directives do not agree with STE (RFC 2119 keywords, house style), obey
  the official directives (rule 1.14). Apply all the other rules around them.
- When you rewrite text, show the result. Then give the important rule corrections in
  one or two sentences — not a full list.
