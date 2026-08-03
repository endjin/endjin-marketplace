# DevOps and Stacked PRs

## Trunk-based development, releasable trunk

Trunk is the integration point and it stays releasable at every commit. Short-lived branches, integrated continuously through stacked atomic PRs; no long-running divergence, no integration big-bangs. Every merge leaves trunk in a state that could ship — which is what makes each merge individually safe to make and individually safe to revert.

**Stop on red trunk.** A broken trunk blocks everyone pulling from it; its repair pre-empts all feature work. Nothing new merges onto red — the andon principle applied to the integration point. Fix forward fast or revert fast; do not build on a broken foundation while debating which.

## Pipeline ordering: fastest-cheapest-first

Order the gauntlet — local and CI alike — so the cheapest, most-likely-to-fail checks run first: format and lint, then compile, then unit tests, then integration, then the slow matrix. Fail fast: the purpose of ordering is to move the moment of bad news as early as possible at zero cost to coverage. A pipeline that runs a forty-minute matrix before a two-second lint check taxes every failure with forty minutes of waiting-waste.

## Stacked-PR mechanics

Each PR in a stack branches from its predecessor and carries exactly one atomic mutation; the stack merges in order, bottom-up. Keep each PR independently green: its own CI run, its own review, its own revert path. When a lower PR changes under review feedback, restack the branches above it promptly — a stale stack accretes conflicts at interest.

## Re-baselining and the squash-merge landmine

When the base PR merges by **squash**, every branch stacked on the *unsquashed* feature branch is now divergent: main contains one new squashed commit, while the stacked branch carries the original commit series plus its own delta. Git sees wholly different histories touching the same files, and a naive merge or rebase produces whole-file conflicts on everything the base PR touched.

The recipe: **re-baseline as main + additive delta, never merge.** Create a fresh branch from post-squash main and apply only the stacked branch's own changes onto it — cherry-pick the delta commits, or diff the stacked branch against its old base and apply that patch. The stacked PR's diff collapses back to just its own mutation. Attempting to merge main into the old stacked branch instead re-litigates the entire squashed change hunk by hunk; it is the landmine, not the fix. Any branch stacked on an unsquashed feature branch will hit this — plan the re-baseline as a routine step of the stack's lifecycle, not an emergency.

## History is not rewritten unilaterally

**No force-push and no history rewrite without explicit human confirmation** — ever. Shared history is a contract with everyone who has pulled it; rewriting it silently breaks their clones and destroys the audit trail the loop depends on. This includes `--force-with-lease`, branch resets on pushed branches, and amending pushed commits. Restacking after a squash-merge creates *new* branches; it does not rewrite what others hold. Reverts likewise require human confirmation: a revert is a judgment call on current evidence, not a mechanical reflex.

## Deploy-and-observe is the full extent of done

Where a deploy target exists, merging is not done — **deploy-and-observe is**. Ship the change through the pipeline to the target, then watch it behave: health signals, error rates, the pre-registered success metrics, cost. For long-lived systems deployment *starts* a standing loop of monitors rather than ending the delivery loop. "It merged" is a proxy signal; a passing proxy is not a succeeding outcome. The change is done when the real system demonstrates the intended behaviour under real conditions — and not before.
