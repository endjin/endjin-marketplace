---
description: Run the full verification gauntlet at real strictness — build, format, whole test matrix; "it builds" is not "it works"
argument-hint: "[optional: project/solution path or scope]"
allowed-tools: ["Read", "Glob", "Grep", "Bash", "Task"]
---

**Scope:** $ARGUMENTS (default: the whole repo)

Run the verification gauntlet, standalone — no loop state required.

1. Detect the platform (see the detection table in the `engineering-loop` router skill) and
   load the matching platform pack from `references/platforms/` — it defines the gauntlet
   steps, strictness flags, and tooling blindspots. Unknown platform → build + test with the
   repo's own scripts at the strictest settings discoverable, and say what was assumed.
2. Order steps **fastest-and-cheapest-first**. Run at full strictness (warnings as errors,
   style in build, format verify). Pin and report exact test counts; treat drift in totals
   (new skips, fewer tests) as a finding, not noise.
3. Honour the platform blindspots (e.g. for .NET: `--no-incremental` for true warning counts;
   `dotnet format` never sees `.csproj`-anchored diagnostics).
4. Report per step: command, outcome, timing. Finish with a clear verdict: what is proven,
   what is NOT proven (untested matrix axes), and the cheapest next check.

Do not fix anything unless asked — this command verifies and reports.
