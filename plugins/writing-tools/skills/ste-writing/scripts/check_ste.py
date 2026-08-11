#!/usr/bin/env python3
"""STE compliance checker for ASD-STE100 Issue 9.

Usage (from the skill root, as in SKILL.md):
    python3 scripts/check_ste.py FILE [FILE ...] [--type procedural|descriptive|mixed]
    cat text.md | python3 scripts/check_ste.py - [--type ...]

Checks (advisory — a human/model must confirm; technical nouns and technical
verbs are legitimately outside the dictionary):
  - unapproved dictionary words (with approved alternatives)
  - words not in the dictionary at all (candidate technical nouns/verbs)
  - sentence length (procedural max 20 words, descriptive/notes max 25)
  - paragraph length (max 6 sentences)
  - semicolons, contractions, Latin abbreviations (e.g., i.e., etc., vs., et al.)
  - gendered pronouns (he/she/his/her/him/hers)
  - "-ing" words that are not approved (most -ing forms are not permitted)
  - passive-voice indicators (be-form + past participle, "by" agent)
  - complex tenses (have/has/had + past participle)

Word counting approximates STE rules 8.5-8.7: hyphenated groups, numbers with
units, alphanumeric identifiers and parenthetical text each count as one word.
Markdown code blocks, inline code, URLs and headings-only lines are skipped.
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

ING_APPROVED = {"lighting", "opening", "routing", "servicing", "mating",
                "missing", "remaining", "something", "during",
                # -ing technical-noun headings STE itself lists as allowed
                "cleaning", "testing", "handling", "packaging", "shipping",
                "troubleshooting", "warning"}
LATIN = re.compile(r"\b(e\.g\.|i\.e\.|etc\.?|vs\.|et al\.|viz\.|cf\.)", re.I)
CONTRACTION = re.compile(r"\b\w+'(t|s|re|ll|ve|d|m)\b", re.I)
S_CONTRACTIONS = {"it's", "that's", "there's", "here's", "he's", "she's",
                  "who's", "what's", "where's", "when's", "how's", "let's"}
GENDERED = re.compile(r"\b(he|she|his|her|him|hers|himself|herself)\b", re.I)
BE_FORMS = {"is", "are", "was", "were", "be", "been", "being"}
HAVE_FORMS = {"have", "has", "had"}
IRREGULAR = {"is": "be", "are": "be", "was": "be", "were": "be", "been": "be",
             "being": "be", "am": "be", "has": "have", "had": "have",
             "did": "do", "done": "do", "does": "do", "made": "make",
             "gave": "give", "given": "give", "went": "go", "gone": "go",
             "goes": "go", "got": "get", "kept": "keep", "held": "hold",
             "found": "find", "came": "come", "fell": "fall", "became": "become",
             "sent": "send", "shown": "show", "showed": "show", "let": "let",
             "put": "put", "set": "set", "read": "read", "told": "tell",
             "thought": "think", "knew": "know", "known": "know",
             "spoke": "speak", "spoken": "speak", "broke": "break",
             "broken": "break", "bent": "bend", "built": "build",
             "cut": "cut", "hit": "hit", "blew": "blow", "blown": "blow",
             "flew": "fly", "flown": "fly", "wrote": "write", "written": "write",
             "these": "this", "those": "that", "an": "a"}
NUMBER_WORDS = {"zero", "one", "two", "three", "four", "five", "six", "seven",
                "eight", "nine", "ten", "eleven", "twelve", "thirteen",
                "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
                "nineteen", "twenty", "thirty", "forty", "fifty", "sixty",
                "seventy", "eighty", "ninety", "hundred", "thousand",
                "million", "billion", "first", "second", "third", "fourth",
                "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
                "half", "quarter"}


def load_dictionary():
    with open(os.path.join(HERE, "ste_dictionary.json"), encoding="utf-8") as f:
        d = json.load(f)
    approved = {}
    for e in d["approved"]:
        approved.setdefault(e["word"].lower(), []).append(e)
    unapproved = {}
    for e in d["unapproved"]:
        unapproved.setdefault(e["word"].lower(), []).append(e)
    return approved, unapproved


def lemmas(token):
    """Candidate base forms for an inflected token (approximate)."""
    t = token.lower()
    out = {t}
    for suf, rep in (("'s", ""), ("s", ""), ("es", ""), ("ies", "y"),
                     ("ed", ""), ("ed", "e"), ("d", ""), ("ing", ""),
                     ("ing", "e"), ("er", ""), ("est", ""), ("ly", "")):
        if t.endswith(suf) and len(t) - len(suf) >= 2:
            out.add(t[: len(t) - len(suf)] + rep)
    # doubled consonant: stopped -> stop, running -> run
    m = re.match(r"^(.+?)([a-z])\2(ed|ing)$", t)
    if m:
        out.add(m.group(1) + m.group(2))
    return out


def strip_markup(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)      # code blocks
    text = re.sub(r"`[^`]*`", " CODE ", text)                # inline code
    text = re.sub(r"https?://\S+", " URL ", text)            # urls
    text = re.sub(r"^\s{0,3}#{1,6}\s*.*$", "", text, flags=re.M)  # md heading lines
    text = re.sub(r"[*_]{1,3}(\S(?:.*?\S)?)[*_]{1,3}", r"\1", text)  # emphasis
    return text


def split_sentences(block):
    # split on sentence enders and list-item boundaries; colon ends a sentence (rule 8.4)
    parts = re.split(r"(?<=[.!?:])\s+|\n\s*[-*•]\s+|\n\s*\d+[.)]\s+|\n\s*[a-zA-Z][.)]\s+", block)
    return [p.strip() for p in parts if p and re.search(r"[A-Za-z]", p)]


def ste_word_count(sentence):
    s = re.sub(r"\([^)]*\)", " PAREN ", sentence)            # parenthetical = 1 word (rule 8.5)
    s = re.sub(r"\"[^\"]+\"|“[^”]+”", " QUOTED ", s)         # quoted text = 1 word (rule 8.6)
    s = re.sub(r"\b\d[\d.,:/]*\s*(°[CF]|[a-zA-Z]{1,4}\b)?", " NUM ", s)  # number+unit = 1 word
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-]*", s)    # hyphenated group = 1 token (rule 8.7)
    return len(tokens)


def is_imperative(sentence):
    first = re.sub(r"^[^A-Za-z]*", "", sentence).split(" ")[0].lower() if sentence else ""
    return first in {"do", "make", "remove", "install", "set", "put", "use",
                     "turn", "push", "pull", "apply", "examine", "read",
                     "open", "close", "start", "stop", "continue", "obey",
                     "connect", "disconnect", "tighten", "loosen", "clean",
                     "record", "select", "send", "run", "add", "delete",
                     "write", "keep", "hold", "lift", "move", "get", "give"}


def check_text(text, doc_type, approved, unapproved):
    findings = {"unapproved": {}, "unknown": {}, "long_sentences": [],
                "long_paragraphs": [], "mechanics": []}
    text = strip_markup(text)
    lines = text.split("\n")

    # line-based mechanical checks
    for i, ln in enumerate(lines, 1):
        if ";" in ln:
            findings["mechanics"].append((i, "semicolon (rule 8.1: not permitted — write two sentences)"))
        m = CONTRACTION.search(ln)
        if m:
            tok = m.group(0).lower()
            # possessive 's is allowed (GR-8), but pronoun/adverb 's forms are contractions
            if not tok.endswith("'s") or tok in S_CONTRACTIONS:
                findings["mechanics"].append((i, f"contraction '{m.group(0)}' (rule 4.2: write words in full)"))
        m = LATIN.search(ln)
        if m:
            findings["mechanics"].append((i, f"Latin abbreviation '{m.group(0)}' (GR-6: use 'for example', 'that is', 'and so on')"))
        m = GENDERED.search(ln)
        if m:
            findings["mechanics"].append((i, f"gendered pronoun '{m.group(0)}' (GR-7: not permitted)"))
        toks = re.findall(r"[A-Za-z][A-Za-z'\-]*", ln.lower())
        PART = {"done", "made", "given", "taken", "gone", "put", "set", "held",
                "kept", "found", "sent", "shown", "broken", "bent", "built",
                "cut", "hit", "blown", "flown", "written", "known", "spoken"}
        for a, b in zip(toks, toks[1:]):
            if a in HAVE_FORMS and (b.endswith("ed") or b in PART):
                findings["mechanics"].append((i, f"complex tense '{a} {b}' (rule 3.2/3.4: use simple tenses only)"))
            if a in BE_FORMS and (b.endswith("ed") or b in PART):
                findings["mechanics"].append((i, f"possible passive '{a} {b}' (rule 3.6: use active voice; OK only if '{b}' shows a condition, as an adjective)"))
            if a in BE_FORMS and b.endswith("ing"):
                findings["mechanics"].append((i, f"progressive tense '{a} {b}' (rule 3.2: not permitted)"))

    # sentence/paragraph checks
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    for p in paragraphs:
        sentences = split_sentences(p)
        # paragraph length only meaningful for running prose (not lists)
        if len(sentences) > 6 and not re.search(r"\n\s*[-*•\d]", p):
            findings["long_paragraphs"].append((sentences[0][:60], len(sentences)))
        for s in sentences:
            n = ste_word_count(s)
            limit = 20 if (doc_type == "procedural" or
                           (doc_type == "mixed" and is_imperative(s))) else 25
            if n > limit:
                findings["long_sentences"].append((n, limit, s[:100]))

    # vocabulary check
    seen = set()
    for token in re.findall(r"[A-Za-z][A-Za-z'\-]*", text):
        low = token.lower()
        if low in seen or len(low) < 2:
            continue
        seen.add(low)
        if token.isupper():          # acronym / quoted placard text
            continue
        if low in {"paren", "quoted", "num", "code", "url", "note", "warning", "caution"}:
            continue
        if low in NUMBER_WORDS or "'" in low:
            continue
        cands = lemmas(low)
        if low in IRREGULAR:
            cands.add(IRREGULAR[low])
        if any(c in approved for c in cands):
            if low.endswith("ing") and low not in ING_APPROVED and not any(
                    c in approved and c != low for c in lemmas(low) if not c.endswith("ing")):
                pass
            continue
        hit = None
        for c in [low] + sorted(cands):
            if c in unapproved:
                hit = c
                break
        if low.endswith("ing") and low not in ING_APPROVED:
            base_ok = any(c in approved or c in unapproved for c in lemmas(low) if c != low)
            findings["unknown"].setdefault(low, "‑ing form: allowed only in technical nouns (rule 3.5)" if base_ok else "‑ing form (rule 3.5) and not in dictionary")
            continue
        if hit:
            parts = []
            for e in unapproved[hit]:
                alts = ", ".join(e["alternatives"]) if e["alternatives"] else \
                    f"[{(e.get('note') or 'rewrite the sentence')[:80]}]"
                parts.append(f"as ({e['pos']}): use {alts}")
            for c in sorted(cands):
                for e in approved.get(c, []):
                    parts.append(f"(approved as {e['word']} ({e['pos']})"
                                 + (f" = {e['meaning'][:60]})" if e['meaning'] else ")"))
            findings["unapproved"][low] = "; ".join(dict.fromkeys(parts))
        else:
            findings["unknown"].setdefault(low, "not in dictionary — OK only if it is a technical noun/verb (rules 1.5/1.12)")
    return findings


def report(findings, name):
    out = [f"== STE check: {name} =="]
    ls = findings["long_sentences"]
    if ls:
        out.append(f"\n-- Sentences over the word limit ({len(ls)}) [rules 5.1/6.3] --")
        for n, limit, s in ls[:30]:
            out.append(f"  {n} words (max {limit}): {s}...")
    lp = findings["long_paragraphs"]
    if lp:
        out.append(f"\n-- Paragraphs over 6 sentences ({len(lp)}) [rule 6.6] --")
        for head, n in lp[:10]:
            out.append(f"  {n} sentences: starts '{head}...'")
    if findings["mechanics"]:
        out.append(f"\n-- Mechanics ({len(findings['mechanics'])}) --")
        for i, msg in findings["mechanics"][:40]:
            out.append(f"  line {i}: {msg}")
    if findings["unapproved"]:
        out.append(f"\n-- Unapproved dictionary words ({len(findings['unapproved'])}) [rule 1.1] --")
        for w, alts in sorted(findings["unapproved"].items()):
            out.append(f"  {w} -> {alts}")
    if findings["unknown"]:
        out.append(f"\n-- Not in dictionary ({len(findings['unknown'])}) — verify each is a real technical noun/verb --")
        out.append("  " + ", ".join(sorted(findings["unknown"])))
    total = (len(ls) + len(lp) + len(findings["mechanics"]) + len(findings["unapproved"]))
    out.append(f"\nSummary: {total} findings to fix, {len(findings['unknown'])} words to verify as technical nouns/verbs.")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+", help="files to check, or - for stdin")
    ap.add_argument("--type", choices=["procedural", "descriptive", "mixed"],
                    default="mixed", help="20-word limit for procedural, 25 for descriptive; mixed applies 20 to imperative sentences")
    args = ap.parse_args()
    approved, unapproved = load_dictionary()
    for f in args.files:
        if f == "-":
            name, text = "stdin", sys.stdin.read()
        else:
            name = f
            with open(f, encoding="utf-8") as fh:
                text = fh.read()
        print(report(check_text(text, args.type, approved, unapproved), name))
        print()


if __name__ == "__main__":
    main()
