# Playbook: ML Experiment

## Frame

Frame the hypothesis, not the model: "replacing X with Y improves metric M by at least δ without degrading guardrails G" — falsifiable, with the decision that hangs on it named. Every ML experiment carries a quality claim by definition ("better model"), so the claim-forces-Tier-2 rule applies to the promotion decision: the evidence bar is at maximum, always. Identify the deployment surface early — offline-only analysis and a model headed for production are different blast radii.

## Plan

The evidence ladder is the plan, and each rung is pre-registered BEFORE training:

1. **Offline eval on a pinned holdout.** Pin the holdout snapshot before any modelling; register the primary metric, the minimum effect size, confidence intervals (trust in a variable world is statistical — one green run proves nothing), the guardrail metrics that may not degrade (latency, calibration, per-segment fairness), and an explicit leakage check (temporal splits honoured, no target-derived features, no train/test contamination through joins or preprocessing fit on the full set).
2. **Shadow deployment or backtest.** The candidate scores real traffic without acting on it; compare against the incumbent on live distributions. Offline metrics on historical data systematically flatter — this rung catches the train/serve skew.
3. **A/B test** with sample size and stopping rule decided UP FRONT. Compute the n required for the registered effect; run to n. Peeking-and-stopping on a good day is p-hacking with extra steps; register any interim looks and correct for them.
4. **Promote** only when every rung passed its pre-registered bar.

Distrust a result that flatters you. AUC 0.99 is not good news — it is a leakage alarm; suspect a feature that encodes the label, a split that leaks the future, or an eval bug before you suspect genius. Interrogate convenient results with the same hostility as bad ones: the prosecutor asks "why is this so good?" and "what would make this number lie?" before any promotion.

## Execute

The atomic unit is a TRACKED RUN: pinned data snapshot + code version + parameters + seed, logged to the experiment tracker. An untracked result is an anecdote — it cannot be reproduced, compared, or audited, and it does not count as evidence. Config and feature-pipeline changes are code changes: they travel through the same changeset discipline as the model.

## Verify

Run the registered eval exactly as registered; a metric swapped after seeing results is a new experiment, not a passed gate. Verify guardrails and per-segment breakdowns, not just the headline aggregate — an average can improve while every important segment degrades.

## Self-review and Reconcile

Deployment STARTS the loop, it does not end it. Promotion ships with standing monitors: prediction-drift, feature-drift, training/serving skew, guardrail metrics, and cost per inference — with alert thresholds and a named owner. The reconcile loop for a model is permanent.

## Kaizen

Log the wastes: experiments without a decision consumer, results lost to untracked runs (rework), leakage found after promotion (the gate: leakage check moves upstream), and A/B tests stopped early on a flattering interim read. Each escape names the missing rung and registers the lens.
