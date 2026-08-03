# Design Principles: Distributed System

Load this pack when the change involves multiple processes communicating over a network: services, message consumers, anything with a remote call in the hot path.

**Partial failure is the normal case, not the exception.** In a single process, a call either happens or it does not. Across a network there is a third state — "sent, outcome unknown" — and it is routine: the request may have executed even though the response never arrived. Design every interaction for all three outcomes; code that models only success/failure is wrong by construction.

**At-least-once delivery is reality; exactly-once is a property you build, not buy.** Timeouts plus retries mean messages and requests WILL arrive more than once. Therefore consumers must be idempotent: dedupe by message id, use natural idempotency keys, make handlers converge on re-delivery (run-twice, same end state). An idempotent consumer turns duplicate delivery from a defect class into a non-event; a non-idempotent one turns every retry into potential double-charging.

**Retry with backoff AND jitter — bounded.** Immediate retry against a struggling dependency is a self-inflicted DDoS; synchronized backoff without jitter produces thundering herds on the same beat. Exponential backoff, randomized jitter, a retry budget, and a circuit breaker so a dead dependency fails fast instead of consuming your threads. Retry only what is safe to retry — which returns you to idempotency.

**Timeouts are contracts, not tuning knobs.** Every remote call declares how long it will wait, and callers budget from theirs: an upstream 2s timeout wrapping a downstream 5s call is a lie in the topology. No infinite waits, anywhere — an unbounded call is a leak waiting for a stuck peer. Timeout values are part of the interface; changing one is an observable behavioural change (Hyrum applies).

**Make CAP-class trade-offs explicit, per interaction.** Under partition you choose availability or consistency; refusing to choose means the system chooses for you, at 3am. For each data flow, state the choice and its consequence in the plan: is stale-read acceptable here? is rejected-write? Eventual consistency is a fine answer and a terrible surprise — consumers must know which reads can be stale and by how much.

**Observability is a precondition, not a feature.** A distributed defect cannot be reproduced in a debugger; the trace IS the reproduction. Correlation ids propagate through every hop, log line, and message header from day one — retrofitting them during an incident is archaeology. Structured logs, RED/USE metrics, and traces are part of Definition of Done for every service-touching slice: you can only manage what you can observe, and in a distributed system you cannot even diagnose without it.
