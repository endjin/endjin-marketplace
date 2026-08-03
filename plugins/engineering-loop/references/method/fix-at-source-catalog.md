# Fix-at-source catalog: truth ↔ gate ↔ runtime context

Every gate exists because a specific class of waste escaped once and was root-caused to the phase boundary that should have caught it. This catalog is the bridge table between the three strata: the **universal truth** (see `first-principles.md`) generates the **gate** (registry-enforced, phase-anchored), and **runtime context** — platform packs, workload playbooks, project-overlay lessons — layers the concrete practice onto the gate at run time. The agnostic core never names a stack; the rows below show how one real project's evidence instantiated each gate.

To use the table: when a defect escapes, locate its waste class, find the truth it violated, and confirm the corresponding gate exists and fired late — then move the gate to the phase listed. If no row matches, the defect is a new lesson: emit it to the registry via kaizen.

## How runtime context layers in

- The **gate** column is fixed methodology (Layer 1).
- **What the gate checks** is supplied by platform packs at run time: for .NET, "run the pre-registered evidence" becomes a BenchmarkDotNet run; for Terraform it becomes `terraform plan`; for a warehouse it becomes a data-diff.
- **Project overlays** add repo-local lenses (e.g. "do not re-propose frozen collections here without a benchmark") that fire only where their `applies_when` selectors match.

## Evidence table (reaqtor .NET 10 modernisation, PRs #155/#156/#163/#165/#170)

| Observed waste (real reference) | Lean waste class | Truth # | Gate | Phase |
|---|---|---|---|---|
| Frozen collections adopted because they *sounded* faster; shipped on PR #155, challenged in review, benchmarked at 1.18–1.24× **slower** on the repo's small reference-keyed tables, reverted in `43168be`. Validation happened as a reaction to review instead of before the work. | Defect + rework | 1 | Evidence pre-registration | Plan |
| Primary-constructor conversions applied by a format sweep, then reverted (`520007e7`); multi-namespace file splits applied to satisfy file-scoped-namespace style, then reverted to keep deliberate grouping (`d0be9cc5`, PR #163 line). The idiom had no declared boundary, and mechanical rules overrode deliberate design. | Over-processing | 21, 15 | Idiom allow/deny + Chesterton intent-check | Plan |
| Analyzer "fudge": an MSTEST0051 finding silenced by collapsing two statements into one chained expression — diagnostic quiet, ambiguity intact. Rejected by the maintainer on PR #165 ("constructing a fudge just to shut it up is not acceptable"); properly fixed across 5 sites in `99f6edff`. | Defect (hidden) | 13 | Honest-binary: fix the complaint or suppress with rationale | Execute / Self-review |
| MSTEST0049 auto-fixer bulk-applied `TestContext.CancellationToken`; it silently **changed overload selection** (`CheckpointAsync(sw)` → a different overload), breaking 2 trace-asserting tests — only what a test happened to catch. Reversed; rule excluded pending safe adoption (PR #165, GH #164). | Defect via automation | 11 | Behavioural-evidence check on every bulk transform | Verify |
| Compiles ≠ works: archived BinaryExpressionSerialization projects retargeted to net10.0 built with 0 errors but threw `PlatformNotSupportedException` at run time (BinaryFormatter removed); 18/35 tests failed until retargeted to net472 (PR #170). | Escaped defect | 3 | Run-it gate: execute on the risk-relevant matrix | Verify |
| Wrong baseline: PR #156 was stacked on the *unsquashed* `feature/dotnet-10`, whose squash-merge (`76c70297`) plus a 2,336-file re-indent (`4a298355`) made a plain merge yield whole-file conflicts on nearly every shared file. Recovered only by re-baselining the additive delta with a saved backup ref and author-approved force-push. | Rework + waiting | 6 | Branch-hygiene: unit of change built on the canonical baseline | Execute |
| Literal-ask trap: issue #169 said "ensure they run" for archived analyzers; executing that literally would have flooded the IDE with thousands of unactionable diagnostics. The real goal — clarified with the human — was "archive opens quietly in Visual Studio" (`RunAnalyzers=false` + `GenerateDocumentationFile=false`, PR #170). | Over-production | 20 | Real-goal confirmation | Frame |
| Re-derived decisions: the Tuplet-vs-ValueTuple trade-off risked re-litigation until the measured verdict (ValueTuple hashes only the last 8 elements past arity 8) was documented in code (`a8fdaac`) and memory; frozen collections carry an explicit "do not re-propose without a benchmark" record. Without persistence, each session pays the derivation cost again. | Motion (re-litigation) | 22 | Persisted decision-capture (ADR/memory) | Learn |

## Reading the pattern

Every row shares one shape: the check that would have prevented the waste existed *in principle* but ran downstream of the mutation — in review, at run time, or never. The correction is never "try harder"; it is to move the check to the phase column above and encode it as a registry lens so the prosecutor asserts it on the next plan. That is fix-at-source: truth 17 (feedback is cheapest at the source) applied to the loop's own defects, via truth 14 (a defect reveals a process gap).
