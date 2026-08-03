# Playbook: Infrastructure Change

## Frame

Classify every affected resource FIRST: stateless and re-creatable (compute, load balancers, DNS records with low TTL) versus stateful (databases, storage, queues with in-flight messages, identity). The classification drives everything downstream: destroy/replace of a stateful resource is a ONE-WAY DOOR — data and connections do not come back with `apply` — and forces the highest evidence bar plus an explicit human go/no-go that cannot be self-satisfied. Map blast radius in infrastructure terms: what shares this VPC, this IAM role, this state file; what breaks transitively when this security group changes.

Verify the baseline before planning against it. State files and recorded baselines DRIFT from reality: manual console changes, out-of-band scripts, half-applied runs. Run a refresh/drift-detect first; a plan computed against a stale baseline is fiction, and applying fiction is how "no changes expected" deletes a production subnet. If drift is found, reconciling it (import or revert) is its own changeset BEFORE the intended change.

## Plan

Plan-before-apply is MANDATORY, never advisory: a reviewed `terraform plan` (or `what-if`, `diff`, change-set preview) is the pre-registered evidence for every slice. The unit of change here lives in an external system, so the concrete previewed mutation — not the source diff — is what gets prosecuted. The Plan gate demands: the saved plan artifact, resource-by-resource; the reversal strategy per slice ("revert = re-apply previous config" is only valid for stateless resources; stateful reversal must be engineered — snapshot, replica, blue/green); and lock/downtime expectations.

Slice at one resource or one module per changeset. A 40-resource plan is unreviewable; drift and mistakes hide in bulk. Consecutive same-shaped low-risk slices may batch through one gauntlet pass, but stateful mutations always travel alone.

## Execute

Apply exactly the reviewed plan (saved plan file, not a re-plan at apply time — the world may have moved). The drift-audit is precise: the apply must touch ONLY declared resources, with ZERO unexpected replacements. Any `-/+` (destroy-and-recreate) that the plan review did not explicitly accept stops the line — replacement is where one-way doors hide inside innocent-looking attribute changes (renames, immutable-field edits).

## Verify

Policy-as-code runs in the gauntlet alongside the plan review: security posture, tagging, encryption, cost policies — machine-checked before apply, not audited after. Post-apply: run a second plan and require empty (convergence proof), then verify the real outcome — endpoints respond, permissions actually grant, alarms are green. A clean apply is a proxy; the service working is the outcome.

## Self-review and Reconcile

Prosecute the plan artifact, blind: undeclared resources, unexpected replacements, IAM widenings, deletion of anything stateful without the go/no-go on record. Post-apply, monitors are the standing reconcile loop — infra "done" means observed healthy, not applied.

## Kaizen

Recurring wastes to register: applies against stale state (gate: mandatory refresh + drift-check), replacements discovered at apply time (gate: `-/+` requires explicit acceptance), console hot-fixes that never came back to code (gate: periodic drift audit), and bulk multi-resource slices that hid one dangerous change among thirty boring ones.
