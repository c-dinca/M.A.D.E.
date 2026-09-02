# ADR-0005 — gVisor is the v1 isolation boundary; Firecracker is deferred behind a provider seam

**Status:** Accepted
**Date:** 2026-08-05
**Relates to:** UF-1, [04-execution-isolation.md](../02-architecture/04-execution-isolation.md), [15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md)

> **This decision's revisit trigger has fired, and the decision is therefore open.** The trigger below
> names "the deployment becomes multi-tenant or hosted by us
> ([ADR-0013](0013-single-tenant-self-hosted-v1.md) reversed)".
> [ADR-0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md) reversed ADR-0013 on 2026-09-02,
> so the condition is met.
>
> **Status is unchanged — Accepted — because a fired trigger reopens a question, it does not answer
> one.** The question is **OQ-10**: whether a user-space kernel is sufficient when the same boundary
> separates customers from each other rather than a customer's code from its own host
> ([02-architecture/18-deployment-and-tenancy.md](../02-architecture/18-deployment-and-tenancy.md)).
> The negative section below already says a Sentry vulnerability is a host compromise; under hosted
> multi-tenancy that is every tenant on the host.
>
> Read this record's costs before answering OQ-10. Nothing here is relaxed by the vision change, and
> the direction of travel is toward a stronger boundary — if it is insufficient, hosted operation is
> suspended rather than the boundary weakened
> ([ADR-0021](0021-deployment-agnostic-core-hosted-and-self-hosted.md), revisit trigger). This record
> is noted rather than superseded because it correctly anticipated the condition; the specification
> should get credit for that rather than have it quietly overwritten.

## Context

Model-generated code must execute somewhere, and the product's central claim is that this is safe
([UF-1](../02-architecture/01-system-overview.md#the-five-unforgivable-failures)). Standard containers
share the host kernel, so a kernel privilege-escalation vulnerability is a host compromise — and the
host in the target deployment is the customer's virtualisation node.

Two credible boundaries exist. Firecracker gives each Sandbox its own kernel under KVM: the stronger
guarantee, and the one the intake identifies as correct for multi-tenant production. gVisor interposes
a user-space kernel and integrates with the existing OCI runtime by installing a binary and adding a
runtime entry.

Three environmental facts decide it. The v1 deployment is single-tenant on a customer's own host, so
the adversary is the customer's own repository content rather than a hostile co-tenant. The target
platform is Proxmox, where a guest may not expose nested virtualisation, making KVM unavailable to the
workload. And the team is one person, for whom TAP networking, rootfs image pipelines and a microVM
lifecycle are weeks of work on the component least likely to differentiate the product at this stage.

## Decision

v1 executes all model-generated code under **gVisor (`runsc`)**, selected explicitly per Sandbox and
never inherited from a daemon default. If the runtime is unavailable or fails its preflight identity
check, the system refuses to execute; there is no fallback to the default runtime
([FR-055](../01-product/03-functional-requirements.md)).

Runtime arguments are minimal. The intake suggests `--net-raw` and `--allow-packet-socket-write` for
Docker compatibility; v1 enables neither, because verification Sandboxes run with no network
([ADR-0006](0006-no-network-in-verification-sandbox.md)) and therefore need neither raw sockets nor
ARP. Adding a capability to satisfy a generic compatibility note is how attack surface accumulates.

All runtime knowledge is confined to `made/sandbox/`, behind the six-operation `SandboxProvider`
interface. Firecracker is Seam 1 in
[15-future-phase-seams.md](../02-architecture/15-future-phase-seams.md).

## Alternatives considered

### Firecracker microVMs now — rejected for v1

The strong case, and the correct end state: a separate guest kernel per Sandbox means a guest kernel
exploit does not reach the host, only the VMM — and the VMM is small, minimal in its device model, and
runs jailed. It is what the intake recommends for production and what a sophisticated security
reviewer will eventually ask for. Density and boot time are excellent.

It lost on two hard facts and one soft one. KVM may not be available inside a Proxmox guest, so the
v1 deployment target might not be able to run it at all — and discovering that at a design-partner
install would be worse than deferring deliberately. Building the control plane around it (networking,
rootfs images, snapshots, a guest agent) is the largest single work item in the roadmap and it
competes directly with the milestones that prove the product works. And v1 is single-tenant, which
removes the co-tenancy threat that most strongly motivates hardware isolation. The residual risk is
recorded and disclosed rather than hidden
([13-security-and-compliance.md](../02-architecture/13-security-and-compliance.md)).

### Standard containers with a hardened seccomp profile — rejected

The case: zero extra runtime to install, no compatibility surprises, negligible overhead, and it is
how most of the industry runs semi-trusted workloads. A tight seccomp profile plus user namespaces,
dropped capabilities and a read-only root filesystem is a real defence, and gVisor's Sentry is itself
a piece of software with vulnerabilities.

Rejected because no profile changes the shared-kernel fact, and the product's differentiator is
precisely that it does not make this trade. Against UF-1 the question is not whether escapes are rare;
it is whether we can tell a security reviewer that a kernel bug does not reach their host.

### Kata Containers — rejected

The case: an OCI-compatible VM boundary, so it slots into the same runtime mechanism as gVisor while
giving hardware isolation — arguably the best of both.

Rejected for the same KVM availability reason as Firecracker, plus heavier boot and memory overhead
against [NFR-001](../01-product/04-non-functional-requirements.md), and because it pulls toward a
Kubernetes-shaped deployment that the one-operator principle rejects.

## Consequences

### Positive

Installation is an apt package and a runtime entry, keeping the bootstrap within
[NFR-020](../01-product/04-non-functional-requirements.md). No KVM requirement, so it runs on the
widest set of customer platforms. Development on any Linux workstation. The escape suite can run in CI
without special hardware, which is what makes [NFR-002](../01-product/04-non-functional-requirements.md)
enforceable on every pull request rather than nightly on special infrastructure.

### Negative

**The boundary is a user-space kernel, not hardware virtualisation: a Sentry vulnerability is a host
compromise.** That is a real residual risk, it is disclosed to customers in those words, and it is
mitigated only by the patch SLO in [NFR-004](../01-product/04-non-functional-requirements.md).
Syscall-heavy workloads run measurably slower, which inflates verification wall-clock and therefore
Sandbox cost. Some workloads hit compatibility gaps in the user-space kernel, and when that happens the
failure looks like a bug in the customer's code rather than in our sandbox, which is an expensive
support conversation. In the default install the control plane shares a host with the sandbox runtime,
so an escape reaches it. And a security-conscious buyer may simply require hardware isolation, in
which case this decision blocks the sale until Seam 1 is built.

## Revisit when

Any of: a customer requires hardware-level isolation as a purchase condition; the deployment becomes
multi-tenant or hosted by us ([ADR-0013](0013-single-tenant-self-hosted-v1.md) reversed); an escape
suite finding cannot be closed within the user-space kernel model; or measured verification wall-clock
under `runsc` exceeds the Sandbox cost budget. The migration is Seam 1 and the escape suite is the
acceptance gate for it.
