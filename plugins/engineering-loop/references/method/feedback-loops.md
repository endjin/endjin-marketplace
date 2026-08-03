# Feedback Loops

Feedback is the only mechanism by which work converges on correctness. Everything else — plans, gates, reviews — is machinery for making feedback arrive earlier, cheaper, and impossible to ignore.

## Fail fast

Order every sequence of checks so the cheapest, most likely-to-fail check runs first. Compile before test, lint before compile where lint is faster, unit before integration, one instance before the bulk transform. A failure discovered in second one costs a second; the same failure discovered after a full matrix run costs the matrix. Fail-fast ordering is pure gain: it changes when bad news arrives, never whether.

## Evidence before claim

Never accept a claim without evidence — including one's own claims, and *especially* the convenient ones. "This should be faster", "this is equivalent", "this can't affect that" are hypotheses; each needs a pre-registered way to be proven wrong before it is acted on as true. Evidence that cannot fail is not evidence. Distrust a result that flatters: interrogate the surprising *and* the convenient with equal suspicion, and understand why the number is what it is, not just that it is green.

## Inner loop vs outer loop

**The inner loop is local, fast, and pre-push:** the local gauntlet (build, tests, analyzers at full strictness, ordered fastest-first), the blind prosecutor over the plan and the diff, and the drift-audit comparing the mutation against declared scope. Inner-loop feedback arrives in seconds to minutes, costs nothing but compute, and embarrasses no one. Run it relentlessly; nothing leaves the machine that the inner loop has not passed.

**The outer loop is remote, asynchronous, and must be actively polled:** CI on the pushed head, human review threads, and — where a deploy target exists — production behaviour itself. Outer-loop feedback is slower, scarcer (human attention is usually the constraint), and higher-stakes. It is also easy to fake-close: pushing and walking away, or glancing at a spinner, is not a loop. **A feedback loop only exists if it is closed** — poll every outer signal to terminal state and drive every finding to resolution (protocol in [outer-loop-ci-and-review.md](outer-loop-ci-and-review.md)).

The two loops are not alternatives; the inner loop exists to keep the outer loop cheap. Every defect the inner loop catches is a review cycle the human never spends and a CI run never wasted.

## Shift-left

Feedback is cheapest at the source. The standing rule: **every check moves to the earliest phase boundary where it can run.** A defect caught at Plan-exit prosecution costs a paragraph rewrite; the same defect at code review costs a round-trip through the constraint; in production it costs an incident. When a check is discovered living late — a validation that only review performs, a claim only production can falsify — treat its position as a defect in the process and move it: review heuristics become prosecutor lenses; production surprises become pre-registered evidence requirements; CI-only failures become local gauntlet steps. The kaizen question is always "what is the earliest boundary at which this could have fired?" — and the answer becomes the gate's new home.

## The andon principle

Anyone — any agent, the human — can stop the line. On spotting a recurring defect class, a broken assumption, or a gate being gamed, the correct move is to halt the flow *now* and fire kaizen mid-loop, not to log it for a retrospective while the line keeps producing the defect. Stopping the line is never a failure; producing waste at full speed is. The pull-cord costs one interruption; the alternative costs the same defect in every node until someone pulls it.
