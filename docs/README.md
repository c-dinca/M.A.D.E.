# Specification

Eight documents, plus the decision records. They can be read end to end; there is no reading path
because there is nothing to skip. Start with [01-product.md](01-product.md) for the vocabulary.

The product is **Scenio**. The operating rules for an agent about to do work are in
[`/AGENTS.md`](../AGENTS.md).

| Document | What is in it |
| --- | --- |
| [01-product.md](01-product.md) | The problem, who it is for, the non-goals, and the brand and vocabulary |
| [02-architecture.md](02-architecture.md) | The loop, the three actors, isolation, concurrency, the Prompt Book, Box Office |
| [03-requirements.md](03-requirements.md) | 25 functional and 10 non-functional requirements, and the twelve surviving stories |
| [04-contracts.md](04-contracts.md) | The normative contracts, and `CON-01`–`CON-06`: what has to change in them first |
| [05-roadmap.md](05-roadmap.md) | Three milestones, each independently demonstrable |
| [06-open-questions.md](06-open-questions.md) | The three that stay open, and what flips if each does |
| [07-deferred.md](07-deferred.md) | Everything cut, one line and a reason each |
| [Decision records](03-adr/README.md) | All 33 ADRs, kept. Decision history is cheap and losing it is expensive |

The previous specification was 79 documents. Where each one went is the last table in
[07-deferred.md](07-deferred.md).

## Source of truth, in order

1. **[`/contracts/`](../contracts/)** — normative. They currently describe a larger product than v1;
   `CON-01` to `CON-06` fix that and they land first.
2. **Accepted ADRs** in [03-adr/](03-adr/README.md).
3. **These eight documents.**
4. **Existing code** — the last thing to trust. There is none yet.

## The working rule

> **No new commits in `docs/` until code runs against a real repository.**

An ADR is the exception. Growth is depth inside these eight, not new files.
