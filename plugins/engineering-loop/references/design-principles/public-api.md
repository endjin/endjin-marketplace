# Design Principles: Public API

Load this pack when the change touches a surface consumed by code you do not control: published libraries, HTTP/RPC endpoints, CLI output, file formats, event schemas.

**Hyrum's law applies at maximum strength.** With enough consumers, EVERY observable behaviour of your API will be depended on by someone — not just the documented contract, but exception types and message text, ordering of results, timing, serialized field order, undocumented-but-reachable members, even bug behaviour. On a public surface, "observable" and "contract" are the same word. Therefore: enumerate what is observable before changing anything, treat every observable delta as a breaking-change candidate, and assume the docs describe a subset of what is actually depended on.

**Semver is a promise, not a labelling scheme.** Breaking changes require a major version — and per Hyrum, "breaking" is judged by observable behaviour, not by whether the signature compiled. Behavioural breaks under an unchanged signature (a method now throws where it returned null, results arrive in a different order) are the ones that hurt, because nothing forces the consumer to look. The gate: any observable-behaviour delta on a public surface must be classified breaking/non-breaking with justification, and the version must agree.

**Evolve additive-first.** Add the new member, overload, field, or endpoint alongside the old; never mutate the meaning of an existing one in place. Additive changes are two-way doors — they can be deprecated and removed on schedule; in-place mutations are immediate breaks for someone. This is expand/contract applied to API surface, and it maps directly onto the changeset stack: add → migrate consumers → deprecate → remove.

**Deprecation is a window, not an event.** Mark, warn, document the replacement, and hold through a published window sized to your consumers' upgrade cadence before removal. Removal is the contract step and inherits its rule: evidence of non-use (telemetry, download stats, major-version boundary) before deletion.

**Postel's principle — and its tension with Hyrum.** Be conservative in what you emit: strict, minimal, canonical output, because every quirk you emit becomes load-bearing. But apply liberal acceptance with open eyes: every malformed input you tolerate becomes, by Hyrum, part of your de-facto contract surface — clients WILL ship payloads only your leniency accepts, and you can never tighten again without breaking them. Prefer strict-with-clear-errors on input unless compatibility genuinely demands tolerance; where you must tolerate, document the tolerance as contract, because that is what it now is.

**Least Astonishment.** The API should behave as its name and shape suggest, consistently with the rest of the surface and the platform's idioms. Every astonishment ships twice: once as a consumer bug, once as a Hyrum dependency when someone relies on the surprising behaviour.
