# Infrastructure and DevOps

Sized for one operator. Every process, alert and manual step is paid for out of one person's attention,
so "boring" here is a correctness requirement rather than a preference: an operator who cannot debug
the system at 22:00 will stop running it. That constraint survives the 2026-09 vision change, which
superseded [ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md) on tenancy while carrying forward
the process-kind and alert ceilings it justified
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md),
[ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

## Environments

| Environment | Purpose | Where | Data |
| --- | --- | --- | --- |
| `local` | Development | Developer workstation, Linux with the isolation runtime installed | Seeded fixtures only, one tenant |
| `ci` | Automated gates | Pipeline runners | Ephemeral; escape suite runs against the real runtime, including the cross-tenant cases |
| `staging` | Pre-release verification and the nightly evaluation run | One host under our control | Seed repositories, several synthetic tenants, no customer data |
| `production — self-hosted` | A customer's own deployment | The customer's host | The customer's own, one tenant |
| `production — hosted` | **New.** The service we operate | Our host | **Several customers' source code** |

> **There is now a production environment we operate**, which is the largest operational change in this
> revision. Under the previous plan "production is whatever the customer installed", and the honest
> consequence recorded in ADR-0013 was that we could not see production at all. Hosted operation
> restores that visibility and takes on the obligation that comes with it: backups contain other
> organisations' source, support contains it, and the compliance questions OQ-02 records become ours
> ([18-deployment-and-tenancy.md](18-deployment-and-tenancy.md)).
>
> **Which shape ships first is OQ-01**, and nothing here assumes it. The bootstrap procedure remains a
> first-class deliverable with a time budget ([NFR-020](../01-product/04-non-functional-requirements.md))
> because the self-hosted shape is the more constraining of the two, and because a hosted deployment is
> bootstrapped by the same procedure.

**`staging` runs several synthetic tenants deliberately.** A single-tenant staging environment cannot
exercise row-level security, cross-tenant reachability or per-tenant admission — which are precisely
the boundaries whose failure is a disclosure rather than a wrong answer
([NFR-029](../01-product/04-non-functional-requirements.md)).

## Topology

Four long-running process **kinds**, the ceiling set by
[NFR-021](../01-product/04-non-functional-requirements.md). The 2026-09 vision change added ingestion,
scheduling, worksite driving and chat egress, and **all of it fits inside the existing kinds** —
recorded here because the obvious reading of "agents that live in your infrastructure" is that it needs
new processes, and it does not
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

| Process kind | Role | Restart behaviour |
| --- | --- | --- |
| `api` | Control API, the console, **and the inbound ingress endpoints** ([FR-116](../01-product/03-functional-requirements.md)) | Stateless; restart freely. An inbound trigger delivered during a restart is redelivered by the provider and rejected as a duplicate if it already landed |
| `worker` | Graph executor, effect handlers, reaper, **scheduler loop, worksite driver loop, chat egress handler** | Holds Run leases; on restart re-acquires and resumes from the event log. A worksite mid-cycle resumes from its own log ([FR-101](../01-product/03-functional-requirements.md)) |
| `postgres` | System of record, three event logs, the work queue, claims, checkpoints | Persistent volume; the one stateful component that matters |
| `objectstore` | Content-addressed artifacts and evidence records, tenant-prefixed (S3-compatible, MinIO) | Persistent volume |

Sandboxes are not processes in this list: they are created and destroyed per Run by the worker through
the sandbox runtime installed on the host.

**Replicating a kind is not a fifth kind.** Running two `worker` processes is permitted by the lease
mechanism and by NFR-021's process-*kind* reading. It is not designed, sized or tested, and **tenant
fairness is the part that would need real work**
([17-persistence-and-concurrency.md](17-persistence-and-concurrency.md)).

Deliberately absent, each with the reason: **no message broker** — Postgres `SELECT … FOR UPDATE SKIP
LOCKED` is sufficient at this concurrency, removes a whole component, and is the only option that can
write an effect in the same transaction as its event; **no cache** — nothing is read often enough to
need one, and a cache is a second source of truth; **no reverse proxy in the default install** — the
operator terminates TLS with whatever they already run, though a hosted deployment will need one and
that is a deployment concern rather than a process kind; **no Kubernetes**; **no separate scheduler,
gateway or notification service** — each would be a fifth kind for work that fits in the first two.

Adding a fifth kind requires a superseding ADR. That rule exists because process count is the variable
that most reliably predicts whether a solo-operated system stays operated, and it is now under more
pressure than when it was written.

## Host requirements

A Linux host with a container runtime, the isolation runtime installed and registered, and KVM *not*
required in v1 — one of the two reasons for the gVisor choice
([ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md)) is that a Proxmox guest may not expose
nested virtualisation. Reference sizing for up to 4 concurrent Runs: 8 vCPU, 32 GB RAM, 200 GB SSD.
Sandboxes are the dominant consumer; the control plane fits in 2 GB
([NFR-024](../01-product/04-non-functional-requirements.md)).

> **Open question OQ-08** — The exact supported host matrix: which distributions and kernel versions
> are tested, and whether the isolation runtime is supported under an unprivileged LXC container on
> Proxmox or requires a full VM guest. **Blocks:** the bootstrap script's preflight check and the
> published system requirements (backlog item `INFRA-02`). **Resolved by:** installing on one
> Proxmox LXC guest and one Proxmox VM guest and recording which passes the escape suite. This must be
> settled before a design-partner install, because a wrong answer here means the isolation claim is
> untested on the customer's actual platform.

## Infrastructure as code

Compose for the process topology, a shell bootstrap for host prerequisites, and a Makefile as the
single entry point. Terraform is **not** used in v1: there is no cloud account to describe, and a
Terraform layer over a single Compose file is ceremony that must be maintained.

Everything an operator does has a Make target, and the target is the documented interface:
`make bootstrap`, `make up`, `make migrate`, `make smoke`, `make backup`, `make restore`,
`make escape`, `make eval`. Anything not reachable through a target is undocumented in practice.

## Configuration and secrets

Configuration is a layered file plus environment overrides, validated at startup against a schema; the
process refuses to start on an invalid or incomplete configuration rather than running with defaults
([FR-046](../01-product/03-functional-requirements.md)). Failing at startup is the honest behaviour:
a system that starts and then fails on the first Run has wasted the operator's time and possibly a
Sandbox.

Secrets — repository credentials and model API keys — are referenced by name and resolved from the
host secret store (environment-injected from a file with restricted permissions in the default
install, or an external manager where the customer has one). Three rules:

1. Secrets never enter a Sandbox ([NFR-005](../01-product/04-non-functional-requirements.md)).
2. Secrets never appear in an API response, including to the `operator` role.
3. Secrets are registered with the redactor at startup so that any accidental appearance in a log,
   event, artifact or prompt is scrubbed before persistence
   ([FR-066](../01-product/03-functional-requirements.md)).

## Database operations

Migrations are forward-only, numbered SQL files applied by a runner at deploy time, and every one must
be safe to apply while the previous version of the code is running — the deploy sequence is migrate,
then restart, and there is a window where both coexist. Practically: add columns nullable or with a
default, never rename in place (add, backfill, switch, drop in a later release), and never drop a
column in the same release that stops writing it.

Backups are nightly `pg_dump` plus an object-store copy, retained per the deployment's retention
setting. A backup that has never been restored is a hypothesis, so
[NFR-025](../01-product/04-non-functional-requirements.md) requires a monthly automated restore drill
onto a clean host with an audit-export comparison.

The one destructive operation the system performs on itself is retention pruning
([09-audit-and-replay.md](09-audit-and-replay.md)), which deletes events and artifacts older than the
configured window. It runs as a separate scheduled target rather than inline, it logs what it removed,
and it refuses to run if a backup has not completed within the last day.

## Deploy and rollback

Deploy: pull the image, run migrations, restart the worker, restart the API. Runs in flight park and
resume from the event log ([NFR-019](../01-product/04-non-functional-requirements.md)); no Run is lost
by a deploy, which is what makes deploying during working hours acceptable for a single operator.

Rollback: restart the previous image tag. Because migrations are forward-only, a rollback is safe only
across a migration that the older code tolerates — which is what the additive rule above guarantees for
one release. Rolling back across two releases requires a restore, and that is documented rather than
pretended otherwise.

Sandbox images are versioned and pinned independently of the application image
([FR-008](../01-product/03-functional-requirements.md)). Rolling back the application does not roll
back a Project's sandbox image, and the Run record's stored digest is what makes an older Run
explainable after either has moved.

## Cost envelope

The dominant costs in a self-hosted deployment are the customer's own: the host, and model tokens if
hosted endpoints are configured. Our infrastructure cost is a staging host and CI minutes.

> **Open question OQ-04** — Infrastructure budget ceiling and available GPU hardware. Recorded in
> [00-context/04-business-model.md](../00-context/04-business-model.md). **Blocks:** whether the
> staging host can run the nightly evaluation against local endpoints or must pay hosted rates for it,
> which changes how often the harness can run.

## Scaling path

The ordering is a prediction about which limit binds first, and it matters because building the wrong
one first is wasted work. The vision change added a step and moved one, and both are marked.

1. **Sandbox concurrency on one host** binds first: CPU and memory per Sandbox against the host's
   capacity. Response: raise host size, lower per-Sandbox limits, or lower the concurrency cap.
2. **Worker throughput** next: more worker processes against the same Postgres. The lease mechanism
   already permits it; nothing changes except the process count, which is why the lease was designed
   this way despite v1 running one worker.
3. **Sandbox hosts as a pool** third: `SandboxProvider` gains a host-selection step. This is the point
   at which the control plane and the sandbox zone stop sharing a host, which also closes the residual
   risk recorded in [ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md).
4. **Postgres** last, and probably never at this workload. When it binds, read replicas for the console
   before anything more exotic. **Note one new pressure**: the effectiveness dashboard's queries fold
   event logs ([02-data-model.md](02-data-model.md#query-rules)), which is why the dashboard is a
   windowed report rather than a live page and why a read replica is the obvious first move if it hurts.

**A step was added, and it is between 2 and 3.** *Tenant fairness in the queue* binds when several
tenants compete for one deployment's capacity, and it binds before the sandbox host pool does. `SKIP
LOCKED` gives no fairness guarantee; per-tenant concurrency caps bound the damage without eliminating
it. The response is either a fairness mechanism in SQL or the message-broker decision reopening, and
the trigger is a measurement — sustained per-tenant queue wait at p95
([ADR-0026](../03-adr/0026-resident-agents-event-ingestion-visible-queues.md)).

**Multi-tenancy is no longer on this path, for a different reason than before.** It used to be off the
path because it was a deferred product change. It is now off the path because it is already built
([ADR-0021](../03-adr/0021-deployment-agnostic-core-hosted-and-self-hosted.md)) — Seam 2 is closed
([15-future-phase-seams.md](15-future-phase-seams.md)). What tenancy contributes to scaling is the
fairness problem above, not a migration.
