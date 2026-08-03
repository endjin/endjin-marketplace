# Platform pack: Python (stub)

Load this pack when the repo fingerprints as Python (`pyproject.toml`, `requirements*.txt`,
`setup.cfg`, `uv.lock`, `poetry.lock`). This is a stub: gauntlet shape and non-negotiables
only; grow it with earned lessons.

## The verification gauntlet (fastest-first)

1. Environment: create/activate the project venv and install from the pinned source
   (`uv sync`, `pip install -r requirements.txt`, or `poetry install`). Never run the
   gauntlet against the system interpreter or a stale venv — half of "works on my machine"
   is an environment mismatch.
2. Lint + format: `ruff check .` and `ruff format --check .` — expect 0 findings.
3. Types: `mypy` (or pyright) at the repo's configured strictness; expect 0 errors.
4. Tests: `pytest`; pin expected counts (total / passed / skipped / xfail) and treat any
   drift as a signal, not noise.

## Pin discipline

Dependencies are pinned via the lockfile (`uv.lock`, `poetry.lock`) or fully-pinned
requirements. A resolver-driven version change is a dependency change: it gets its own
changeset, and it never rides silently inside a feature change. If the lockfile diff surprises
you, stop and explain it before committing.

## Grow this pack via kaizen

Stubs accrete lessons through the registry: when a defect on this platform root-causes to a
gate this pack should have stated, emit the lesson as a `platform:python` record and fold the
ratified rule into this file. The dotnet pack grew that way; this one will too.
