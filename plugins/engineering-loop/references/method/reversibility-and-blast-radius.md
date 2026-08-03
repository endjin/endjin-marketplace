# Reversibility and Blast Radius

## Two-way and one-way doors

Classify every node before executing it. A **two-way door** is a decision that can be walked back cheaply: a code change behind a revert, a config toggled off, a branch deleted. A **one-way door** cannot: data deleted, a message emitted to an external consumer, a schema dropped, an API published and depended upon. The classification drives everything downstream: **scrutiny is spent in proportion to irreversibility.** Two-way doors deserve speed — pushing a reversible change through heavyweight ceremony is over-processing; the cheapest way to evaluate it may be to walk through and look. One-way doors deserve the full apparatus: Tier 2, previewed mutations, engineered rollback, human sign-off.

## Irreversible until proven otherwise

Effects that **mutate external state, emit side effects, or delete data are presumed irreversible until a reversal path is engineered** — not assumed, engineered. "We could probably restore it" is not a reversal path; a tested procedure is. The standard constructions:

- **Expand/contract** — evolve schemas and interfaces additively (add → backfill → dual-write → cut over → drop), so every step is individually revertible and the old path survives until the new one is proven.
- **Dual-write** — write old and new paths in parallel, read from old, observe divergence before trusting new; reverting is a read-path switch.
- **Blue-green** — keep the previous deployment live and routable; reversal is a traffic flip, not a rebuild.
- **Snapshot/restore** — capture state immediately before the mutation, with the restore actually rehearsed; an untested backup is a hope, not a path.
- **Soft-delete** — mark-and-retain instead of destroy; the drop becomes a deferred, separately gated step after a soak window.

A node whose reversal path is one of these constructions may be treated as a two-way door — *because engineering made it one*. A node with none of them is one-way regardless of how routine it feels.

## You can't unship data — forward-fix

Some doors have no engineering that reopens them. Data already delivered to consumers, events already emitted, files already served: revert is impossible, because the world has seen the value and may have acted on it. For these, the defect response is **forward-fix**:

- **Corrective backfill** — publish corrected data through the same channel, idempotently keyed so consumers converge on the right values.
- **Restore-from-snapshot** — where internal state was damaged, restore, then replay forward the legitimate changes since.
- **Consumer notification** — tell every affected downstream *what* was wrong, *which* records and time-range, and *what corrective action* they must take. Discoverable-but-unannounced corrections leave consumers acting on bad data; notification is part of the fix, not a courtesy.

Plan the forward-fix path *before* shipping anything irreversible: where revert is impossible, the recovery plan is part of Definition of Ready.

## Blast radius: declared and minimised

Know the blast radius before acting, and make it as small as the change allows — per node. Declare, alongside scope: which systems, consumers, data, and users the change can affect if it goes wrong; whether the failure is contained (one service, one table) or propagating (every downstream of a shared contract). The declaration is prosecutable — "no downstream impact" is a claim, and lineage or consumer enumeration is its evidence.

Then minimise: feature-flag the activation apart from the deployment, canary before full rollout, rate-limit bulk operations, bound every automated transform to an explicit set before running it unbounded, and split a wide change into narrow staged ones where possible. Blast radius, with reversibility, is a primary tier-selection input: small radius + two-way door justifies Tier 0 speed; wide radius or a one-way door forces the ceremony that earns the risk.
