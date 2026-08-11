# Apply STE to software and business documents

ASD-STE100 has two types of writing. Each document type uses one type or the two types:

- **Procedural writing** (section 5): instructions that the reader must do. Imperative
  form, maximum 20 words in each sentence, one instruction in each sentence.
- **Descriptive writing** (section 6): information, without the imperative form. Maximum
  25 words in each sentence, one topic in each sentence. Paragraphs start with a topic
  sentence and have a maximum of six sentences.

Software terms are correct technical nouns and technical verbs. STE category 19 (computer
science: backup, database, e-mail, firewall, interface, network, software, update) has
most of the necessary nouns. Technical verb category 2 (click, enter, install, download,
reboot, save, scroll, upload) has most of the necessary verbs. Domain words such as
"repository", "deployment", "container", and "endpoint" are technical nouns (rules
1.5/1.6). Use one term for one item (rule 1.11): use "repository" or "repo", not the two.

The dictionary shows its examples in uppercase letters only for display. STE does not tell
you to write uppercase text (your style guide can tell you to use uppercase, for example
in warnings).

## Documentation (READMEs, how-to guides, runbooks)

- Overview sections are descriptive. Task sections are procedural. Divide the two clearly.
- Task sections: numbered steps, imperative form, one instruction in each step. Condition
  first: "If the build stops with an error, read the log file."
- Do not put instructions in notes. A note gives information only (rule 5.5). Put limits
  and results in the step: "Do the test. The maximum time for the test is 60 seconds."
- Command names, code, flags, and file paths are quoted text (rule 8.6). Keep them as
  they are, in code format. Each counts as one word.

## ADRs (architecture decision records)

An ADR is descriptive writing only. You tell about a decision — you do not give
instructions.

- **Title**: a short name for the decision.
- **Status**: one word or one short sentence ("Accepted". "This ADR replaces ADR-012.").
- **Context**: topic sentence first, then one fact in each sentence. Give values, not
  opinions (rule 4.1): not "Performance was suboptimal" but "The p95 latency was
  2.1 seconds. The limit is 0.5 seconds."
- **Decision**: the simple future or the simple present, with a clear agent: "We will use
  PostgreSQL for the order data." Do not use the passive voice ("It was decided that...").
- **Consequences**: one result in each sentence. Use "As a result," and "But" to
  connect the sentences. Give the negative results clearly: "But then each
  deployment must include a schema migration step."

## Specifications and requirements

Descriptive writing. Be careful with the modal verbs:

- The word "must" is approved for requirements: "The API must send a response in less
  than 200 ms."
- "shall" is not approved — use "must". "should" is not approved — use the simple present
  or future, or give the condition. "may" is not approved — use "can" or "possibly".
- If official directives tell you to use the RFC 2119 keywords (SHALL, SHOULD, MAY), obey
  the directives. The keywords are then quoted terms. Apply all the other rules.
- Write one requirement in each sentence, always with an agent: "The service must log
  each login failure." Do not write "Failed logins are to be logged."
- Use vertical lists (rule 4.3) for series of more than two items.

## Changelogs and release notes

Obey the "Keep a Changelog" standard, version 1.1.0
(https://keepachangelog.com/en/1.1.0/), for the structure. Write the entries in STE
(descriptive writing).

Structure (Keep a Changelog 1.1.0):

- Use the file name `CHANGELOG.md`. Write the changelog for persons, not for machines.
- Give each version its own entry. Put the newest version at the top.
- Give the release date of each version in the ISO 8601 format (YYYY-MM-DD):
  `## [2.4.0] - 2026-08-11`.
- Keep an `[Unreleased]` entry at the top. It shows the changes that will be in the next
  release.
- Group the changes in each entry by type, with these six headings: `Added` (new
  features), `Changed` (changes to available features), `Deprecated` (features that
  a subsequent release will remove), `Removed` (features that this release removed),
  `Fixed` (defect corrections), and `Security` (vulnerability corrections). Use only the
  headings that have content. The headings are quoted titles — keep them.
- Make sure that readers can make a link to each version and to each heading.
- Tell the readers if the project obeys Semantic Versioning.
- If you remove a release, keep its entry and add the `[YANKED]` tag:
  `## [0.0.5] - 2014-12-13 [YANKED]`.

Entries in STE:

- The usual fragment style ("Added support for SSO") has no subject. This is not
  permitted (rule 4.2). Write full sentences with the release or the component as the
  agent: under `Added`, "This release adds single sign-on." Under `Fixed`, "The export
  command again writes correct CSV files."
- "We removed the v1 API. Use the v2 API." (A migration instruction can be imperative —
  it is procedural.)
- A breaking change is a safety instruction (section 7). Put it under its heading and
  give the command and the risk: "CAUTION: This release changes the configuration
  format. Do the migration steps before you do the upgrade. If you do not do them, the
  service will not start."

## User messages (UI text, error messages, notifications)

Mostly procedural: the user must know what occurred and what to do.

- Give the cause or the condition first, then the instruction, then the result if the
  result helps: "The file is larger than 10 MB. Select a smaller file."
- Be accurate, not abstract: not "Invalid input" but "The date must have the format
  YYYY-MM-DD."
- Use a maximum of 20 words in each sentence. On screens, shorter sentences are better.
- Write all the subjects, verbs, and articles (rule 4.2): not "File too large" but "The
  file is too large."
- If there is a risk to the user's data, use the safety instruction structure
  (section 7) — command, then result: "Do not close the window. If you close the window,
  the application will delete the data that you did not save."

## Notes, internal messages, and email

Descriptive writing, with procedural parts when the reader must do a task.

- Start with the topic sentence: the one thing that the reader must know.
- Use one topic and a maximum of six sentences in each paragraph (rule 6.6). Use a
  maximum of 25 words in each sentence.
- An instruction to a person is procedural: "Please do a review of the pull request
  before Friday." ("please" is an approved word.)
- You can keep a friendly tone. STE only makes sure that each sentence is clear.

## Commit messages

- Subject line: imperative form, usually much less than 20 words: "Remove the retry loop
  from the upload client."
- Body: descriptive sentences that give the cause: "The retry loop caused duplicate
  uploads when the network was slow."
