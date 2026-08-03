# Platform pack: Node.js (stub)

Load this pack when the repo fingerprints as Node (`package.json`, a lockfile,
`tsconfig.json`). This is a stub: gauntlet shape and non-negotiables only.

## The verification gauntlet (fastest-first)

1. Install from the lockfile: `npm ci` (or `pnpm install --frozen-lockfile` /
   `yarn install --immutable`). Never plain `npm install` in the loop — it can mutate the
   lockfile.
2. Typecheck: `tsc --noEmit` (or the repo's `typecheck` script).
3. Lint: `eslint .` at the repo's configured strictness; expect 0 errors and 0 warnings.
4. Test: the repo's test runner; pin expected counts and treat drift as a signal.
5. Build: the production build last — it is usually the slowest signal.

Use the repo's own scripts (`npm run <x>`) when they exist; they encode local intent.

## Lockfile discipline

The lockfile is part of the change. Never hand-edit it; never commit a lockfile diff you did
not intend; a dependency bump and a behaviour change are separate changesets. A lockfile
change without a dependency change means stop and find out why.

## Audit

`npm audit` is a signal to triage, not a gate to blindly satisfy: classify each finding
(reachable? production dependency?) before acting; never bulk-upgrade to silence it.

## Grow this pack via kaizen

Stubs accrete lessons through the registry: when a defect on this platform root-causes to a
gate this pack should have stated, emit the lesson as a `platform:node` record and fold the
ratified rule into this file. The dotnet pack grew that way; this one will too.
