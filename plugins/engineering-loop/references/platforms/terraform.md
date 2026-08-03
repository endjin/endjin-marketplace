# Platform pack: Terraform (stub)

Load this pack when the repo fingerprints as Terraform (`*.tf`, `.terraform.lock.hcl`,
`terragrunt.hcl`). This is a stub: gauntlet shape and safety idioms for changes whose effects
live in an external system; grow it with earned lessons.

## The verification gauntlet (fastest-first)

1. `terraform fmt -check -recursive` — cheapest signal.
2. `terraform validate` (after `terraform init -backend=false` where a backend isn't needed
   for the check).
3. `terraform plan -out=tfplan` against the real backend — the plan IS the diff of the real
   mutation. Render it (`terraform show tfplan`) and review it line by line.

## The plan is the evidence

A reviewed plan is the platform's preview-the-real-mutation evidence: the source diff shows
what you edited; only the plan shows what will happen to the world. No apply without a
reviewed plan produced from the same code and state being applied.

## Destroy/replace detection is a one-way door

Scan every plan for `destroy` and `replace` (forces replacement) actions. Each is a
**one-way-door escalation**: it presumptively loses state (data disks, databases, DNS) and
requires explicit human confirmation with a stated reversal path — or a refactor
(`moved` blocks, `lifecycle.prevent_destroy`) that avoids the replacement.

## Policy as code

Run checkov (or OPA/conftest) over the plan output as a gate, not a suggestion; suppress a
policy finding only with written justification in the code.

## State drift

Verify the baseline before planning: run `terraform plan -refresh-only` first. If it is not
empty, the world has drifted from state — reconcile that as its own changeset before layering
your change on top, or your plan conflates two mutations.

## Grow this pack via kaizen

Stubs accrete lessons through the registry: when a defect on this platform root-causes to a
gate this pack should have stated, emit the lesson as a `platform:terraform` record and fold
the ratified rule into this file.
