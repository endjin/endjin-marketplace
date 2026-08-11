# Data science documents

How the rulebook applies to analysis and modeling documents. Rule IDs refer to
`rules.md`.

## Model cards

Description with values. Sections, in order:

1. **Intended use** — what the model is for, and explicitly what it is not for: "Ranks
   support tickets by urgency. Not suitable for automated closure decisions."
2. **Training data** — sources, date range, size, known gaps: "2.1 M tickets,
   2023-01-01 to 2026-06-30, English only; enterprise customers are underrepresented
   (8% of rows, 31% of traffic)."
3. **Metrics** — the number, the dataset it was measured on, and the comparison point
   (W5, D4): "Macro-F1 0.83 on the 2026-Q2 holdout, against 0.79 for the previous
   model."
4. **Limitations and failure modes** — stated plainly, one per sentence: "Accuracy
   falls to 0.61 on tickets shorter than 10 words."
5. **Ethical considerations** — concrete risks and mitigations, not boilerplate; use
   `inclusive-language.md` for wording about people and groups.

Never let an adjective carry a claim a number should carry: "performs well" is not a
sentence for a model card.

## Notebooks

A notebook is a narrative with executable evidence. The markdown carries the argument;
the code carries the proof.

- Open with the question and the answer (D1): the first cell states what the notebook
  investigates and, once known, what it found. A reader must not run 40 cells to learn
  the conclusion.
- One topic per markdown cell, topic sentence first (D1, D2). Headings mark the
  argument's structure, not the code's ("Why April sales dip", not "More plots").
- Interpret every figure in prose next to it: what the reader should see, and what it
  means. A bare chart is data, not analysis.
- State data provenance and snapshot dates in the first section — "reads
  `mart.daily_orders` as of 2026-08-01" — so results are reproducible (M3).
- Keep hedging honest and quantified: "the effect is small (2%, within the ±3% noise
  band)" rather than "there might possibly be a slight effect".

## Experiment reports

Description with one decision at the end.

- **Hypothesis** — one sentence, falsifiable: "Reranking with the new embedding model
  increases click-through on the top-3 results."
- **Setup** — variants, assignment unit, dates, sample size, and the pre-registered
  decision metric, each as a value (M3).
- **Results** — the metric, its uncertainty, and the comparison, in active voice: "The
  treatment increased top-3 CTR by 1.8% (95% CI: 0.4%–3.2%)." Report the failures and
  the guardrail metrics with the same prominence as the wins.
- **Decision** — an instruction or a stated choice with an agent: "We will ship the
  reranker to 100% on 2026-09-01", or "We will not ship; latency rose 40 ms and CTR
  gains were within noise."

## Analysis write-ups

- Lead with the finding, not the journey (D1): "Churn concentrates in month 2" — the
  methodology comes after.
- Separate observation from interpretation from recommendation, and label them: the
  reader must know which sentences are data and which are judgment.
- Numbers get denominators and baselines: "conversion rose 12% (from 2.5% to 2.8%,
  n = 48,000)" (W5).
- Every recommendation is an instruction with an owner (V4): "Marketing should
  consider..." → "Recommendation: Marketing tests a month-2 discount (owner: lifecycle
  team)."
