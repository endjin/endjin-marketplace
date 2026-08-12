#!/usr/bin/env python3
"""Validate a ticket-workflow configuration file against the schema.

Checks the structure the plan-ticket and implement-ticket skills depend on: every section
present, every key answered, and every file path mentioned actually on disk. It cannot
check whether a value is *correct* — only that a lookup will not come back empty.

Usage:
    python3 check-config.py [path-to-config]

With no argument it searches the documented order from the current directory.
Exit codes: 0 clean, 1 problems found, 2 no config located.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

SEARCH_ORDER = (
    ".claude/ticket-workflow.md",
    ".github/ticket-workflow.md",
    ".agents/ticket-workflow.md",
    "ticket-workflow.md",
)

SCHEMA: dict[str, tuple[str, ...]] = {
    "Tracker": (
        "System",
        "Access",
        "Coordinates",
        "Ticket types",
        "Plan location",
        "Acceptance criteria location",
        "Body format",
        "Comment format",
        "Comment editing",
        "Blocking marker",
        "Child items",
    ),
    "Source control": (
        "Host",
        "Base branch",
        "Branch naming",
        "Commit conventions",
        "Rebase policy",
        "Worktrees",
    ),
    "Pull requests": (
        "Access",
        "Draft support",
        "Linked work item",
        "Description limits",
    ),
    "Quality gates": (
        "Lint and format",
        "Tests",
        "Test traps",
        "Manual verification",
        "Additional gates",
    ),
    "Code review": (
        "Reviewer",
        "Fallback",
        "Escalation",
        "Finding disposition",
    ),
    "Writing style": (
        "Ticket and PR register",
        "Documentation register",
        "Code comments",
    ),
    "Project conventions": (
        "Context files",
        "Architecture decisions",
        "Documentation",
        "Post-PR steps",
    ),
}

# A value that is still the template's guidance comment, or empty, is not an answer.
PLACEHOLDER = re.compile(r"^\s*(<!--.*?-->\s*)*$", re.S)


def locate(argv: list[str]) -> Path | None:
    if len(argv) > 1:
        candidate = Path(argv[1])
        return candidate if candidate.is_file() else None
    for relative in SEARCH_ORDER:
        candidate = Path(relative)
        if candidate.is_file():
            return candidate
    return None


def split_sections(text: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current: str | None = None
    lines: list[str] = []
    for line in text.splitlines():
        heading = re.match(r"^##\s+(.+?)\s*$", line)
        if heading and not line.startswith("###"):
            if current is not None:
                sections[current] = "\n".join(lines)
            current, lines = heading.group(1), []
        elif current is not None:
            lines.append(line)
    if current is not None:
        sections[current] = "\n".join(lines)
    return sections


def read_keys(body: str) -> dict[str, str]:
    """Map each bold key in a section to its value, joining any continuation lines."""
    keys: dict[str, str] = {}
    current: str | None = None
    for line in body.splitlines():
        bullet = re.match(r"^\s*[-*]\s+\*\*(.+?)\*\*\s*:\s*(.*)$", line)
        if bullet:
            current = bullet.group(1)
            keys[current] = bullet.group(2)
        elif current and line.strip() and line.startswith((" ", "\t")):
            keys[current] += " " + line.strip()
        elif not line.strip():
            current = None
    return keys


def main() -> int:
    config = locate(sys.argv)
    if config is None:
        where = sys.argv[1] if len(sys.argv) > 1 else " or ".join(SEARCH_ORDER)
        print(f"No ticket-workflow configuration found ({where}).")
        print("Run the ticket-workflow-init skill to write one.")
        return 2

    text = config.read_text(encoding="utf-8")
    sections = split_sections(text)
    problems: list[str] = []
    answered = 0

    for section, expected in SCHEMA.items():
        if section not in sections:
            problems.append(f"missing section: ## {section}")
            continue
        found = read_keys(sections[section])
        for key in expected:
            if key not in found:
                problems.append(f"{section} → missing key: {key}")
            elif PLACEHOLDER.match(found[key]):
                problems.append(f"{section} → unanswered key: {key}")
            else:
                answered += 1

    # Paths mentioned in the config should exist, so a pointer never dangles. Naming *patterns*
    # are not paths — skip anything carrying a placeholder token.
    root = Path.cwd()
    patternish = re.compile(r"NNNN|YYYY|\{|<|\*")
    for match in re.finditer(r"`([\w.][\w./-]*\.(?:md|json|ps1|sh|py|yaml|yml|toml))`", text):
        path = match.group(1)
        if "/" not in path or patternish.search(path):
            continue
        if not (root / path).exists():
            problems.append(f"path does not exist: {path}")

    total = sum(len(keys) for keys in SCHEMA.values())
    print(f"Config: {config}")
    print(f"Answered {answered} of {total} keys.")

    if problems:
        print(f"\n{len(problems)} problem(s):")
        for problem in problems:
            print(f"  - {problem}")
        print("\n'None', 'Not used' and 'Not applicable' are valid answers; a blank key is not.")
        return 1

    print("No structural problems found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
