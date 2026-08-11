# Inclusive language

Bias-free writing costs nothing and widens your audience. This guidance expresses, in
this skill's own words, principles published in the Microsoft Style Guide's bias-free
communication section
(https://learn.microsoft.com/en-us/style-guide/bias-free-communication) and in
inclusive-terminology work across the industry (Google developer style guide, IETF
terminology drafts, the Inclusive Naming Initiative).

## Gender

- Write around gendered pronouns rather than defaulting to "he" (or alternating "he/she",
  "s/he" — avoid those constructions entirely). In order of preference: address the
  reader as "you"; use the plural ("developers... they"); repeat the role noun ("the
  reviewer"); use singular "they" for an unspecified person.
- Use gender-neutral role words: chair (not chairman), workforce or staff (not manpower),
  synthetic (not man-made), operates or staffs (not mans), person-hours (not man-hours).
- For a real, known person, use the pronouns that person uses.
- Gendered wording is correct in direct quotations, formal titles, and when gender is the
  actual topic.

## Disability

- Person first, condition second, and only when relevant: "users who are blind", not
  "blind users"; "a developer who uses a screen reader", not "a screen-reader user" when
  the person matters more than the tool.
- Never use wording that frames disability as tragedy or deficit: "suffers from",
  "afflicted with", "wheelchair-bound" → "has", "uses a wheelchair".
- Do not borrow disability as metaphor: "blind spot" → "gap"; "falls on deaf ears" →
  "is ignored"; "crippled" (of a system) → "degraded", "impaired".

## Culture, geography, and idiom

- Idioms, sports metaphors, and pop-culture references fail in translation and exclude
  readers who do not share the culture: "hit it out of the park", "boil the ocean",
  "drink the Kool-Aid" → say the literal thing.
- Use diverse, internationally spellable names in examples (Amara, Chen, Fatima, Jonas,
  Priya, Sofia — not Alice and Bob every time), and avoid stereotyped role casting (the
  manager is not always "he"; the junior engineer is not always "she").
- Do not generalize about countries, regions, or cultures, even positively. Avoid
  politically contested labels for regions; use the name your audience's atlas uses.
- Use ISO 8601 dates (2026-08-11) and name time zones explicitly — "tomorrow" and
  "9 a.m." exclude every reader in another zone.

## Technical terms with exclusionary history

Use the modern replacements. They are also more precise.

| Avoid | Use |
|---|---|
| whitelist / blacklist | allowlist / blocklist (or denylist) |
| master / slave | primary / replica, primary / secondary, controller / worker |
| master branch | main branch |
| grandfathered | legacy status, exempt |
| sanity check | quick check, confidence check, validation |
| dummy value | placeholder, sample value |
| tribal knowledge | institutional knowledge, undocumented knowledge |
| man-in-the-middle | adversary-in-the-middle, on-path attack |
| hang (of a program) | stop responding, become unresponsive |
| kill (a process, in prose) | stop, end (the command names stay: `kill -9`) |
| abort (in prose) | stop, cancel (API names stay: `AbortController`) |
| native (feature) | built-in |
| first-class citizen | fully supported |
| demilitarized zone (DMZ) | perimeter network |

Command names, API identifiers, and quoted output are untouchable (`git branch master`
in a historical log stays as it was). The replacements apply to the prose you write and
to the names you choose for new things.

## Tone

- Do not blame the user: "Invalid input" and "You entered the wrong value" → "The date
  must have the format YYYY-MM-DD."
- Avoid violent metaphors where a neutral verb exists: "kill the connection", "nuke the
  cache" → "close the connection", "clear the cache".
- Warmth is compatible with precision. "Please" is fine in requests; hedging ("maybe
  possibly try") is not.
