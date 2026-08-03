# Playbook: Modernization

The evidence base: the reaqtor .NET 10 migration (PRs #155/#163/#165/#170). Every rule below was paid for there.

## Frame

Inventory before intent. Graph the codebase: projects, TFMs, package references, generated code, archived corners, and the dependency edges between them. Modernization risk lives in the edges — the project you forgot references the one you changed. Classify each region: live product, test infrastructure, archive. Archives get their own node with a different definition of done (see below).

Choose the ordering strategy up front. LTS-leapfrog: retarget only onto LTS releases and skip STS versions entirely; between retargets, run cheap SDK-compat passes (new SDK, old TFM) so the eventual jump is small. Retargeting onto an STS buys you a forced second migration within a year — pure rework waste.

## Plan

Separate mechanical sweeps from semantic migration, and never mix them in one changeset. Reaqtor's file-scoped-namespace sweep touched 2,342 files, fully automated, in ~2-3 hours; the semantic migration touched 2,043 files and took ~23 hours. Interleaving them makes every diff unreviewable and every revert entangled. Mechanical nodes batch through one gauntlet pass; semantic nodes get individual scrutiny.

Decide the idiom allow/deny register UP FRONT — this is the gate that prevents the reverts:

- Primary constructors: rejected by the owner. Owner taste is a legitimate deny reason; discover it at Plan, not in review.
- Multi-namespace file splits: denied. The rule is "use file-scoped namespaces where appropriate, not at all costs" — never restructure deliberate design to satisfy a mechanical idiom.
- Frozen collections: the canonical lesson. Adopted because they sounded right; benchmarked only after review challenge; measured 1.18-1.24x SLOWER on small reference-type-keyed tables; reverted. Any perf-idiom adoption is a quality claim and therefore demands a pre-registered benchmark BEFORE adoption, on the real workload shape. No benchmark, no adoption.

## Execute

Run analyzer modernization in waves, one rule-class per wave. Each finding gets the honest binary: fix the cause or suppress with recorded justification — prove-not-quiet, never a silent NoWarn. After fixing one instance, sweep siblings: the same pattern exists elsewhere; fix the class, not the file.

Auto-fixers need behavioural verification, not visual inspection. Reaqtor's MSTEST0049 auto-fix silently switched an assertion overload and broke 2 tests — the diff looked mechanical and was not. Bound every bulk transform; prove one instance safe before scaling; run the tests after, every time.

Archives: compiles ≠ works. Keep legacy code on the TFM where it actually RUNS; the archive goal is "opens and builds quietly in the IDE" (analyzers off, doc-gen off), not forced retargeting that produces a compiling artifact nobody can execute.

## Verify

The fixed gauntlet runs before EVERY commit, no exceptions: build Debug AND Release at full strictness, `dotnet format --verify-no-changes`, full test suite. Release-only and Debug-only failures are both real; format drift compounds silently; and a modernization that trims a single test has destroyed evidence — test count may never decrease without prosecuted justification.

## Self-review and Reconcile

Ship as a stacked PR sequence, each independently green and revertable: core migration → mechanical reformat → analyzer modernization → archive repair. Reviewers approve intent once per layer instead of drowning in a 4,000-file diff.

## Kaizen

The wastes to log: idioms adopted on fashion then reverted (the frozen-collections shape — move the benchmark upstream), interleaved mechanical/semantic diffs (rework), STS retargets (scheduled rework), and fixer output trusted without behavioural check. Every revert is a missing Plan-phase gate; name it and register the lens.
