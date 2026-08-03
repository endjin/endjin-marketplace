# Playbook: Refactor

## Frame

State what a refactor is and hold to it: a change to structure with NO change to observable behaviour. If the intent includes any behavioural delta — a fixed bug, a new capability, a performance claim — that is a different workload wearing a refactor's name; split it out and route it to its own playbook. Clarify the motive too: a refactor without a consumer (an upcoming feature, a recurring defect class, a measured comprehension cost) is speculative work, and YAGNI applies to structure as much as to features.

## Plan

Behaviour-preservation IS the pre-registered evidence, and it is beautifully cheap: the existing tests, unchanged, stay green. The Plan gate demands two things: (1) the test files are declared out of scope — a diff that edits tests to keep them passing has changed behaviour and is disqualified as a refactor; (2) coverage over the affected region is honestly assessed BEFORE mutation. Where coverage is thin, write characterisation tests first: pin the CURRENT behaviour, including its warts, without judging it. They are the harness that makes the refactor falsifiable; land them as their own preparatory changeset, green before the restructuring begins.

Separate enabling-refactor from behaviour-change as distinct changesets, always. When a feature needs room made, the sequence is: refactor changeset (tests unchanged, green) → behaviour changeset (new tests, new behaviour). A reviewer can then verify each with the matching cheap question — "same behaviour?" then "right behaviour?" — instead of untangling both from one diff.

Apply Chesterton's Fence before removing or restructuring anything: do not tear down a fence until you know why it was put up. That odd guard clause, redundant-looking lock, or seemingly dead branch may encode a production incident. Investigate via history, blame, comments, and linked issues; write down what you found. "I could not determine why this exists" is a finding that RAISES the evidence bar (characterise it, widen the search for callers), never a licence to delete. If the fence turns out to be genuinely purposeless, record that rationale so nobody re-litigates it.

Apply Hyrum's Law to every observable change: with enough consumers, every observable behaviour will be depended on by someone — including ordering of results, exception types and messages, serialized shapes, timing, and public-but-"internal-use" members. A refactor that alters any of these is a breaking-change candidate regardless of what the docs promised. Enumerate consumers before touching an interface; where the surface is public, escalate to the public-api design pack and treat the change as behavioural, not structural.

## Execute

Small reversible steps, each leaving the tree green — never a big-bang restructure validated only at the end. Mechanical renames/moves travel separately from semantic restructuring so tooling noise does not bury the real change.

## Verify

Full gauntlet with the original tests untouched. Diff the test tree mechanically: zero test edits, zero skips added, zero assertions weakened. Any behavioural delta discovered mid-flight stops the line: re-plan, split, declare.

## Self-review and Reconcile

Prosecute with: "cite the evidence this preserves behaviour" and "why was each removed thing safe to remove?" Unexplained deletions are rejections.

## Kaizen

Log the wastes: refactors with no consumer (over-production), behaviour changes smuggled in structure diffs (the gate: test-tree diff must be empty), and fences torn down blind — each production regression from a removed "useless" guard is a Chesterton escape; register the lens.
