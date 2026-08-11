# Word choices

Three lists: plain substitutions for inflated words, buzzwords to avoid, and filler to
delete. The checker (`scripts/check_writing.py`) applies all of them. None of these are
bans on quoted text, identifiers, or established technical senses — "deploy", "execute",
and "terminate" are normal words in software contexts; the lists target their use as
business-speak.

## Plain substitutions

Use the right column unless the left column is a term of art in context.

| Inflated | Plain |
|---|---|
| utilize, utilise | use |
| commence, initiate | start |
| terminate (non-technical) | end, stop |
| endeavor, attempt (verb) | try |
| ascertain, determine (find out) | find out, check |
| purchase | buy |
| assist, assistance | help |
| approximately | about |
| additional | more, extra |
| sufficient | enough |
| insufficient | not enough |
| demonstrate | show |
| modification | change |
| functionality | features, behavior |
| prioritize | rank, decide first |
| remainder | rest |
| numerous | many |
| obtain | get |
| provide | give (or the specific verb) |
| request (verb) | ask for |
| require | need (or "must" for obligations) |
| subsequent | later, next |
| subsequently | later, then |
| prior to | before |
| in advance of | before |
| in order to | to |
| in the event that | if |
| in the case of | for, if |
| due to the fact that | because |
| for the purpose of | to, for |
| at this point in time | now |
| on a daily basis | daily, every day |
| with regard to, in relation to | about |
| a number of | some, several (or the number) |
| the majority of | most |
| has the ability to, is able to | can |
| is required to | must |
| in a timely manner | promptly (or the deadline) |
| take into consideration | consider |
| make a decision | decide |
| perform an analysis of | analyze |
| conduct an investigation | investigate |
| carry out, perform | do (or the specific verb) |
| ensure | make sure, confirm |
| whilst, amongst | while, among |
| upon | on, when |
| per (each) | each, for each |

## Buzzwords to avoid

From the GOV.UK style guide "words to avoid" (Government Digital Service, reused under
the Open Government Licence v3.0,
https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Each is
fine in its literal sense (a key that unlocks, software you deploy); avoid the
metaphorical, corporate sense.

| Avoid | Use instead |
|---|---|
| agenda (unless a meeting) | plan |
| collaborate | work with |
| combat (unless military) | solve, fix |
| deliver (unless post/goods) | make, create, provide |
| deploy (unless military/software) | use, build, put into place |
| dialogue | discussion, spoke to |
| empower | allow, give permission |
| facilitate | say specifically how you help |
| foster (unless children) | encourage, help |
| impact (unless collision) | have an effect on, influence |
| incentivise | encourage, motivate |
| key (unless it unlocks) | important, main |
| land (unless aircraft) | get, achieve |
| leverage (unless financial) | use |
| liaise | work with |
| overarching | remove it, or "encompassing" |
| progress (verb) | work on, develop |
| promote (unless advertising/career) | recommend, support |
| robust (unless a sturdy object) | comprehensive, fault-tolerant (say how) |
| streamline | simplify, remove steps |
| tackle | stop, solve, deal with |
| transform | describe the specific change |
| drive (metaphor) | cause, encourage |
| going forward, moving forward | from now on |
| one-stop shop, portal, hub | website, service |

## Vague qualifiers — replace with a value

significantly, substantially, dramatically, very, extremely, highly, seamless,
performant, blazingly, efficient(ly) (without numbers), enhanced, improved (without
saying what changed), state-of-the-art, cutting-edge, best-in-class, world-class,
scalable (without limits), flexible (without options), powerful.

Weak: "Query performance improved significantly."
Clear: "The p95 query latency fell from 4.2 s to 300 ms."

## Filler and reader-hostile words — delete

- **simply, just, easily, obviously, of course, straightforward, trivially**: they add no
  information, and they insult the reader for whom the step is not simple.
- **please note that, it should be noted that, it is important to note that**: state the
  fact directly.
- **as you can see, clearly**: if it were clear, you would not need to say so.
- **basically, essentially, actually, really**: delete; the sentence keeps its meaning.
- **very unique, absolutely essential, completely eliminate**: drop the intensifier —
  the adjective is already absolute.
