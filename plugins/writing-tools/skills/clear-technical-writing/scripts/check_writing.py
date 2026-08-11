#!/usr/bin/env python3
"""Clear-technical-writing checker.

Usage:
    python3 check_writing.py FILE [FILE ...] [--type instructions|description|mixed]
    cat text.md | python3 check_writing.py - [--type ...]

Advisory checks against the clear-technical-writing rulebook (rules.md):
  - sentence length: instructions max 20 words, description max 25 (S2)
  - paragraphs over 6 sentences (D2)
  - passive voice and complex tenses (V1, V2)
  - semicolons in prose (S4), Latin abbreviations (W4)
  - inflated words/phrases with plain substitutions (W1)
  - buzzwords used metaphorically (W1; GOV.UK style guide list, OGL v3.0)
  - vague qualifiers that should be values (W5)
  - filler / reader-hostile words (word-choices.md)
  - non-inclusive terms with modern replacements (inclusive-language.md)
  - gendered pronouns used generically (inclusive-language.md)

The checker is advisory: quoted text, identifiers, and legitimate technical senses
(deploy software, execute a query) are for the writer to judge. Markdown code blocks,
inline code, and URLs are skipped automatically.

Word counting (S2): a number with its unit, a hyphenated group, inline code, and a
parenthetical each count as one word.
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

BE_FORMS = {"is", "are", "was", "were", "be", "been", "being"}
HAVE_FORMS = {"have", "has", "had"}
PARTICIPLES = {"done", "made", "given", "taken", "gone", "put", "set", "held", "kept",
               "found", "sent", "shown", "broken", "built", "written", "known", "run",
               "seen", "begun", "chosen", "brought", "thought", "caught", "led", "left"}
IMPERATIVE_STARTS = {"run", "set", "use", "open", "close", "add", "remove", "install",
                     "create", "delete", "click", "select", "enter", "type", "start",
                     "stop", "restart", "check", "make", "read", "write", "save",
                     "deploy", "configure", "update", "test", "verify", "confirm",
                     "choose", "copy", "move", "rename", "download", "upload", "back"}


def load_data():
    with open(os.path.join(HERE, "word_data.json")) as f:
        return json.load(f)


def strip_markup(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`[^`]*`", " CODE ", text)
    text = re.sub(r"https?://\S+", " URL ", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"[*_]{1,3}(\S(?:.*?\S)?)[*_]{1,3}", r"\1", text)
    return text


def split_sentences(block):
    parts = re.split(r"(?<=[.!?:])\s+|\n\s*[-*•]\s+|\n\s*\d+[.)]\s+", block)
    return [p.strip() for p in parts if p and re.search(r"[A-Za-z]", p)]


def word_count(sentence):
    s = re.sub(r"\([^)]*\)", " PAREN ", sentence)
    s = re.sub(r"\"[^\"]+\"|“[^”]+”", " QUOTED ", s)
    s = re.sub(r"\b\d[\d.,:/]*\s*(°[CF]|%|[a-zA-Z]{1,4}\b)?", " NUM ", s)
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-]*", s))


def is_imperative(sentence):
    first = re.sub(r"^[^A-Za-z]*", "", sentence).split(" ")[0].lower() if sentence else ""
    return first in IMPERATIVE_STARTS


def find_terms(text_lower, mapping):
    """Return {term: replacement} for every term present as a whole word/phrase."""
    hits = {}
    for term, repl in mapping.items():
        pat = r"(?<![A-Za-z-])" + re.escape(term).replace(r"\ ", r"\s+") + r"(?![A-Za-z-])"
        if re.search(pat, text_lower):
            hits[term] = repl
    return hits


def check_text(text, doc_type, data):
    f = {"long_sentences": [], "long_paragraphs": [], "mechanics": [],
         "substitutions": {}, "buzzwords": {}, "inclusive": {},
         "vague": [], "fillers": [], "gendered": []}
    text = strip_markup(text)
    lower = text.lower()
    lines = text.split("\n")

    for i, ln in enumerate(lines, 1):
        low = ln.lower()
        if ";" in ln:
            f["mechanics"].append((i, "semicolon — write two sentences (S4)"))
        for latin in data["latin"]:
            if re.search(r"(?<![A-Za-z])" + re.escape(latin.rstrip('.')) + r"\.?(?![A-Za-z])", low):
                f["mechanics"].append((i, f"Latin abbreviation '{latin}' — use the English words (W4)"))
                break
        toks = re.findall(r"[A-Za-z][A-Za-z'\-/]*", low)
        for a, b in zip(toks, toks[1:]):
            if a in HAVE_FORMS and (b.endswith("ed") or b in PARTICIPLES):
                f["mechanics"].append((i, f"complex tense '{a} {b}' — use a simple tense (V2)"))
            if a in BE_FORMS and b.endswith("ing"):
                f["mechanics"].append((i, f"progressive '{a} {b}' — use a simple tense or state the time (V2)"))
            if a in BE_FORMS and (b.endswith("ed") or b in PARTICIPLES):
                f["mechanics"].append((i, f"possible passive '{a} {b}' — name the agent, or keep if it states a condition (V1)"))
        for g in data["gendered_pronouns"]:
            if re.search(r"(?<![A-Za-z])" + re.escape(g) + r"(?![A-Za-z])", low):
                f["gendered"].append((i, g))

    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    for p in paragraphs:
        sentences = split_sentences(p)
        if len(sentences) > 6 and not re.search(r"\n\s*[-*•\d]", p):
            f["long_paragraphs"].append((sentences[0][:60], len(sentences)))
        for s in sentences:
            n = word_count(s)
            limit = 20 if (doc_type == "instructions" or
                           (doc_type == "mixed" and is_imperative(s))) else 25
            if n > limit:
                f["long_sentences"].append((n, limit, s[:100]))

    f["substitutions"] = find_terms(lower, data["substitutions"])
    f["buzzwords"] = find_terms(lower, data["buzzwords"])
    f["inclusive"] = find_terms(lower, data["inclusive"])
    f["vague"] = [w for w in data["vague"]
                  if re.search(r"(?<![A-Za-z])" + re.escape(w) + r"(?![A-Za-z-])", lower)]
    f["fillers"] = [w for w in data["fillers"]
                    if re.search(r"(?<![A-Za-z])" + re.escape(w) + r"(?![A-Za-z-])", lower)]
    return f


def report(f, name):
    out = [f"== clear-writing check: {name} =="]
    if f["long_sentences"]:
        out.append(f"\n-- Sentences over the limit ({len(f['long_sentences'])}) [S2] --")
        for n, limit, s in f["long_sentences"][:30]:
            out.append(f"  {n} words (max {limit}): {s}...")
    if f["long_paragraphs"]:
        out.append(f"\n-- Paragraphs over 6 sentences ({len(f['long_paragraphs'])}) [D2] --")
        for head, n in f["long_paragraphs"][:10]:
            out.append(f"  {n} sentences: starts '{head}...'")
    if f["mechanics"]:
        out.append(f"\n-- Voice, tense, punctuation ({len(f['mechanics'])}) --")
        for i, msg in f["mechanics"][:40]:
            out.append(f"  line {i}: {msg}")
    if f["substitutions"]:
        out.append(f"\n-- Inflated words and phrases ({len(f['substitutions'])}) [W1] --")
        for t, r in sorted(f["substitutions"].items()):
            out.append(f"  {t} -> {r}")
    if f["buzzwords"]:
        out.append(f"\n-- Buzzwords ({len(f['buzzwords'])}) [W1; GOV.UK list, OGL v3.0] --")
        for t, r in sorted(f["buzzwords"].items()):
            out.append(f"  {t} -> {r}")
    if f["vague"]:
        out.append(f"\n-- Vague qualifiers — replace with values ({len(f['vague'])}) [W5] --")
        out.append("  " + ", ".join(sorted(f["vague"])))
    if f["fillers"]:
        out.append(f"\n-- Filler / reader-hostile words — usually delete ({len(f['fillers'])}) --")
        out.append("  " + ", ".join(sorted(f["fillers"])))
    if f["inclusive"]:
        out.append(f"\n-- Non-inclusive terms ({len(f['inclusive'])}) [inclusive-language.md] --")
        for t, r in sorted(f["inclusive"].items()):
            out.append(f"  {t} -> {r}")
    if f["gendered"]:
        seen = sorted({g for _, g in f["gendered"]})
        out.append(f"\n-- Gendered pronouns — check each is a real, known person --")
        out.append("  " + ", ".join(seen))
    total = (len(f["long_sentences"]) + len(f["long_paragraphs"]) + len(f["mechanics"])
             + len(f["substitutions"]) + len(f["buzzwords"]) + len(f["vague"])
             + len(f["fillers"]) + len(f["inclusive"]))
    out.append(f"\nSummary: {total} findings. All findings are advisory — judge each in context.")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+", help="files to check, or - for stdin")
    ap.add_argument("--type", choices=["instructions", "description", "mixed"],
                    default="mixed")
    args = ap.parse_args()
    data = load_data()
    for path in args.files:
        text = sys.stdin.read() if path == "-" else open(path).read()
        print(report(check_text(text, args.type, data),
                     "stdin" if path == "-" else path))
        print()


if __name__ == "__main__":
    main()
