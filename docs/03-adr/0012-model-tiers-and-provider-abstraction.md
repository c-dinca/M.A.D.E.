# ADR-0012 — Capability tiers behind an OpenAI-compatible adapter; no default model

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** FR-046, FR-047, [02-architecture.md](../02-architecture.md)

## Context

The system must run against hosted endpoints for a customer who wants maximum capability and against
local endpoints for one who cannot let source leave the building. Those are not two configurations of
the same product; the air-gapped case is a primary positioning claim
([01-product.md](../01-product.md)), so it cannot be a
degraded path.

The intake names specific models and prices. Those figures are recorded as unverified
([01-product.md](../01-product.md))
and, more importantly, model catalogues move faster than this specification. Any architecture that
encodes a model name inherits that churn.

## Decision

Calling code names a **capability tier** — `PLAN`, `EDIT`, `NAV`, `CRITIC` — and never a model
([FR-047](../03-requirements.md)). One `LLMClient` owns tier resolution,
admission control, tokenisation, structured-output enforcement, metering, retry and fallback; nothing
else in the codebase talks to a provider.

The v1 adapter speaks **OpenAI-compatible chat completions**, because hosted vendors and local servers
both expose it, so one code path covers hosted and air-gapped deployments.

**There is no built-in default model.** The system refuses to start if any tier is unconfigured
([FR-046](../03-requirements.md)). Each tier has a configured primary and
fallback, and every call records provider, pinned model identifier, tier, prompt version and whether
the fallback was used.

## Alternatives considered

### Native SDKs per vendor, with a thin internal interface — rejected

The strong case: native SDKs expose capabilities the compatible surface does not — vendor-specific
prompt-caching controls, richer structured-output modes, precise usage reporting including cache hit
counts, and better error taxonomies. Since prompt caching is our largest cost lever
([02-architecture.md](../02-architecture.md)) and cached-token ratio is a tracked
budget ([NFR-013](../03-requirements.md)), losing fidelity there is a real
cost, not a theoretical one.

It lost on maintenance arithmetic for one engineer. Each SDK is a dependency with its own release
cadence, its own auth model and its own breaking changes, and covering hosted plus local means at
least three. The compatible surface covers the whole capability set the system actually uses today,
and the escape hatch is explicit: a native adapter may be added when a *required* capability is
unreachable, recorded as a note on this ADR rather than added quietly.

### Adopt a model-routing library or gateway (LiteLLM-style) — rejected

The case: someone else maintains the adapters, provider quirks are already handled, fallback and
retry come built in, and it supports far more providers than we would.

Rejected on two grounds. As a library it is a broad dependency in the most security-sensitive data
path in the system — the one that carries customer source — and its transitive surface is large. As a
gateway process it breaches the four-process ceiling
([NFR-021](../03-requirements.md)). Metering, admission control and
idempotency also have to be ours regardless, since they are tied to our ledger and event log, so the
library would sit *inside* our client rather than replacing it.

### Ship sensible default models — rejected

The case: it makes first-run experience dramatically better. An operator who just installed the system
wants it to work, not to read a model-selection guide, and a good default is a kindness.

Rejected because a default is wrong for an air-gapped customer, silently binds us to a vendor, and
produces a surprise bill on first Run — the exact grievance the product positions against. Failing at
startup with "tier EDIT has no configured endpoint" is a better first experience than a Run that
quietly spends money at a vendor the operator did not choose.

## Consequences

### Positive

Air-gapped and hosted deployments share one code path, so the air-gapped configuration is exercised by
every test rather than being a special case that rots. Model changes are configuration, and the
evaluation harness can compare candidates without a code change. Cost becomes a per-Project dial the
operator controls. No vendor lock-in and no strategic dependency on a rented capability.

### Negative

Vendor-specific capabilities are unavailable until someone writes an adapter, and prompt-cache
reporting fidelity varies by provider — so [NFR-013](../03-requirements.md)
is only measurable where the provider reports cache usage, and the metric has a hole. Structured
output quality differs across endpoints, so a local model may need more repair retries than a hosted
one, which shows up as cost rather than as an obvious incompatibility. Onboarding requires the operator
to make four decisions before anything runs, which is friction against
[NFR-020](../03-requirements.md). And a tier abstraction hides genuine
differences between models, so a tier swap can change behaviour in ways the type system cannot warn
about — which is exactly why the evaluation gate in
[NFR-027](../03-requirements.md) exists.

## Revisit when

A required capability — a caching control, a structured-output mode, or usage reporting needed for
[NFR-013](../03-requirements.md) — is unreachable through the compatible
surface and materially affects cost or correctness. Then add one native adapter for that provider,
keep the tier interface unchanged, and record it here.
