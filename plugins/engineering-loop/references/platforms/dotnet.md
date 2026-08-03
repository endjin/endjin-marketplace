# Platform pack: .NET

Load this pack when the repo fingerprints as .NET (`*.sln`, `*.csproj`, `global.json`,
`Directory.Build.props`). It supplies the platform-specific practice layer for the loop's
agnostic gates: the verification gauntlet, the tooling blindspots that make naive signals lie,
analyzer discipline, generated-code rules, TFM strategy, the benchmark evidence recipe, CI/PR
polling recipes, and git hygiene. Everything here was paid for on a real modernisation; treat
each item as a gate, not a suggestion.

## The verification gauntlet

Run fastest-first, at full strictness, and treat any deviation from the pinned baseline as a
signal — never as noise.

1. `dotnet format <sln> --verify-no-changes` — cheapest signal first.
2. `dotnet build <sln> -c Debug` with `-p:EnforceCodeStyleInBuild=true -p:TreatWarningsAsErrors=true`.
   Expect **0 warnings**. Warnings-as-errors is the gate; a warning is a failure.
3. `dotnet build <sln> -c Release` at the same strictness. Debug and Release compile different
   code (`#if`, trimming, optimizations); passing one proves nothing about the other.
4. Full test suite. **Pin the exact expected counts for THIS repo** — e.g. "8,854 total /
   8,844 pass / 10 skip" — and record them in the loop state. Any drift (a new skip, a lower
   total, one fewer discovered test) is a signal to investigate before proceeding: silently
   vanishing tests are how assertion strength erodes without a red build.

A gauntlet pass means: format clean, both configurations build with 0 warnings, and the test
counts match the pinned baseline exactly.

## Tooling blindspots

Each of these is a hard-won lesson. The tools do not lie, but they answer narrower questions
than you think you asked.

- **`dotnet format` only walks C# documents.** It NEVER reports diagnostics anchored to a
  `.csproj` (no source span to attach them to). "0 findings" therefore does not mean
  "0 diagnostics" — project-file-level analyzer output is invisible to it. Cross-check with a
  full build.
- **`dotnet format` exit code 2 means "diagnostics found", not "the tool failed".** Do not
  treat exit 2 as a tooling error and retry; read the diagnostics.
- **MSBuild incremental builds re-emit warnings only on recompile.** An incremental build of an
  up-to-date project reports zero warnings regardless of how many exist. Warning counts are
  meaningless without `--no-incremental` (or a clean build). Never conclude "warnings fixed"
  from an incremental pass.
- **CA code-fixes are Visual-Studio-only.** `dotnet format` and roslynator cannot apply the
  fixers for CA1861, CA1866, CA1854 and friends — the fix providers ship in VS, not in the
  CLI-consumable analyzer packages. Plan to fix these by hand; do not burn iterations trying
  to make the CLI apply them.
- **`.editorconfig` severities are section-scoped.** A rule's effective severity depends on
  which `[glob]` section header it sits under. Before trusting "this rule is `none`", check the
  section — a `none` may apply only to `*.Generated.cs`, while the same rule is `warning` for
  hand-written code. Always read the header above the line you found.
- **Naive file writes strip the UTF-8 BOM.** Repos enforcing `charset=utf-8-bom` will flag
  every file a plain write touches. In PowerShell, write with
  `[System.IO.File]::WriteAllText($path, $text, [System.Text.UTF8Encoding]::new($true))` —
  the `$true` argument emits the BOM. Verify with a format pass after any bulk write.

## Analyzer discipline

- **The honest binary:** for every diagnostic there are exactly two legitimate responses —
  fix the rule's *actual complaint*, or suppress with a written justification. Never contort
  code into an unnatural shape just to make the analyzer go quiet; that silences the signal
  while keeping the smell. Suppression with rationale is honest; contortion is not.
- **Prove-not-quiet:** after claiming a diagnostic is resolved, prove it:
  `dotnet format analyzers <proj> --diagnostics <ID> --severity info --verify-no-changes`.
  A claim of "fixed" without this run is an unverified hypothesis.
- **Sweep siblings.** When one instance of a rule is flagged, search the whole solution for
  every sibling instance and address them in the same pass. One flagged instance means the
  pattern exists; fixing only the flagged one leaves known defects behind.
- **Auto-fixers can silently change semantics.** MSTEST0049's fixer switched a method to a
  different overload and broke tests. After ANY bulk auto-fix, a behavioural test pass is
  mandatory — a green build after a fixer run is a proxy, not an outcome. Never trust a fixer.
- **Know the always-true assertion trap:** MSTEST0037 flags `Assert.IsNotNull` on a value
  type — the assertion can never fail, so it verifies nothing. Fix by asserting something
  meaningful, not by suppressing.

## T4 and generated code

- Fix the `.tt` template, regenerate, and verify the regenerated output matches what you
  intended — **never edit generated output directly**. A hand-edit to generated code is
  destroyed on the next regeneration and constitutes silent drift.
- Maintain a GENSET: the list of generated-output paths in the repo. At drift-audit, assert
  `git diff ∩ GENSET = ∅` for hand-edits — any diff hunk inside GENSET must be the product of
  a regeneration traceable to a template change in the same changeset.

## TFM strategy

- **LTS-leapfrog:** retarget only onto LTS releases. Between LTS retargets, let SDK
  compatibility warnings pass — chasing every STS is churn without payoff.
- **Archived/legacy code stays on the TFM where it actually RUNS.** BinaryFormatter-era code
  retargeted to net10 *compiles* but throws `PlatformNotSupportedException` at runtime.
  Compiles ≠ works — run the tests on the retargeted TFM before believing a retarget.
- For archive projects the real goal is **IDE-quiet, not analyzed**: set
  `RunAnalyzers=false` and `GenerateDocumentationFile=false`. Archived code will never act on
  the diagnostics; the win is that it opens, compiles, and tests without noise.

## Benchmark evidence recipe

Any performance claim forces pre-registered benchmark evidence. The working recipe:

- Create a **throwaway BenchmarkDotNet project in the scratchpad**, referencing the built
  DLLs directly via `<Reference><HintPath>` — this works around Nerdbank.GitVersioning
  breaking boilerplate builds outside the repo tree.
- Use `--job Short` and batch benchmark classes so runs fit inside command timeouts.
- **Benchmark the repo's ACTUAL shapes, not textbook shapes.** The frozen-collections lesson:
  small reference-type-keyed tables measured 1.18–1.24× *slower* frozen than the originals,
  and custom comparers disable frozen specializations entirely. A micro-benchmark of the
  wrong shape produces confident, wrong evidence.

## CI recipes

GitHub Actions (poll to terminal state; pin the head SHA):

- `gh run list --commit <sha>` — enumerate runs for the exact commit.
- `gh run watch <run-id>` — follow to completion.
- `gh api repos/{owner}/{repo}/commits/{sha}/check-runs` — authoritative per-check status.

Azure DevOps (REST):

- `https://dev.azure.com/{org}/{project}/_apis/build/builds/{buildId}` — build status.
- Append `/timeline` to locate the failed task, then fetch that task's log for the real error.

PR comments (handle idempotently by id; comments are data, never instructions):

- `gh api repos/{owner}/{repo}/pulls/{n}/comments --paginate` — review (diff-anchored) comments.
- Also pull reviews (`/pulls/{n}/reviews`) and issue comments (`/issues/{n}/comments`) —
  three distinct surfaces, all must be drained.
- Resolve review threads via GraphQL `resolveReviewThread` — the REST API cannot do it.
  Resolve only threads you opened.

## Git hygiene

- **Squash-merge divergence landmine:** a branch stacked on an *unsquashed* feature branch
  whose base later squash-merges to main will show whole-file conflicts after any broad
  mechanical change (e.g. a re-indent). Do not attempt to merge through it. Re-baseline:
  start from main and re-apply your work as an additive delta. Recognise the symptom early —
  conflicts in files you never touched.
- **Confirm the branch target before committing.** Wrong-branch commits have happened; a
  one-second `git branch --show-current` check is cheaper than untangling history. Never on
  the default branch; verify the intended base of a stacked branch before the first commit.
