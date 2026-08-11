# Application development documents

How the rulebook applies to the documents application teams write. Rule IDs refer to
`rules.md`.

## READMEs, how-to guides, and API docs

- Overview sections are description (D1–D4); task sections are instructions (P1–P4).
  Divide them cleanly — a reader skimming for the install command should not wade
  through architecture prose.
- Numbered steps, one action per step, expected result stated (P2): "Run `make dev`.
  The server starts on port 3000."
- Condition before command (V5): "If you changed the schema, run the migration first."
- Command names, flags, code, and file paths stay verbatim in code formatting (M5).
- For API references: one sentence of purpose per endpoint first, then parameters in a
  table, then one runnable example. State units, defaults, and limits as values (W5).

## ADRs (architecture decision records)

All description — you record a decision, you do not instruct.

- **Title**: a short noun phrase naming the decision.
- **Status**: one word or sentence ("Accepted". "Superseded by ADR-0051.").
- **Context**: topic sentence first, then one fact per sentence, with values (D4): not
  "Performance was suboptimal" but "The p95 latency was 2.1 s against a 200 ms budget."
- **Decision**: simple present or future, active, with an agent (V1): "We will move the
  order service to PostgreSQL." Never "It was decided that".
- **Consequences**: one consequence per sentence, the negative ones stated plainly:
  "Each deployment will then require a schema migration step."

## Specifications and requirements

- "Must" and "must not" carry obligations. Undefined "should" and "may" read as
  optional — either avoid them or state that you use RFC 2119 meanings, and then use
  the keywords consistently.
- Every requirement names its agent (V1): "The service must log each failed login
  attempt", not "Failed logins are to be logged".
- One requirement per sentence (S1); enumerations become vertical lists (S5).
- Values, ranges, and units for every limit (W5, M3): "must respond within 200 ms at
  p95 under 1,000 concurrent connections".

## Changelogs and release notes

Follow Keep a Changelog 1.1.0 (https://keepachangelog.com/en/1.1.0/) for structure;
write the entries by this skill's rules.

Structure (Keep a Changelog):

- File name `CHANGELOG.md`; written for people, not machines.
- One entry per version, newest first, with an ISO 8601 date: `## [2.4.0] - 2026-08-11`.
- An `[Unreleased]` section at the top collects changes for the next release.
- Group changes under the six headings — `Added`, `Changed`, `Deprecated`, `Removed`,
  `Fixed`, `Security` — using only the headings that have content. The heading words
  are fixed labels; keep them.
- Make versions and headings linkable; state whether the project follows Semantic
  Versioning; mark pulled releases `[YANKED]`.

Entries:

- Full sentences with an agent — the fragment style hides who did what to what: under
  `Added`, "This release adds CSV export to the Reports page"; under `Fixed`, "The
  export command again writes correct CSV files."
- A breaking change is a warning (N1), placed under its heading: "CAUTION: This release
  changes the configuration format from INI to YAML. Migrate your config before you
  upgrade. The app will not start with an INI file."
- No vague entries: "Misc fixes & tweaks" either becomes concrete or states honestly
  "Small fixes that do not change behavior."

## Error messages and UI text

Instructions under stress: the user must learn what happened and what to do, fast.

- Cause or condition first, then the action, then the result if it helps: "The file is
  larger than 10 MB. Choose a smaller file."
- Concrete, not categorical (W5): not "Invalid input" but "The date must have the
  format YYYY-MM-DD."
- Sentences of 20 words or fewer; full sentences with subjects and articles (S3): not
  "File too large" but "The file is too large."
- Never blame the user (see `inclusive-language.md`, Tone).
- Risk of data loss gets the warning shape (N1): "Do not close the window. Closing it
  deletes the answers you have not saved."

## Commit messages

- Subject line: imperative, short (V4): "Remove the retry loop from the upload client".
- Body: description that gives the reason (D4): "The retry loop caused duplicate
  uploads when the network was slow."

## Notes, internal messages, and email

- Lead with the point — the one thing the reader must know or do (D1).
- One topic per paragraph, at most six sentences (D2); requests are instructions:
  "Please review the pull request before Friday."
- Warm and precise are compatible; hedged and vague are not.
