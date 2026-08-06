# Infrastructure and DevOps

Sized for one operator ([ADR-0013](../03-adr/0013-single-tenant-self-hosted-v1.md)). Every process,
alert and manual step is paid for out of one person's attention, so "boring" here is a correctness
requirement rather than a preference: an operator who cannot debug the system at 22:00 will stop
running it.

## Environments

| Environment | Purpose | Where | Data |
| --- | --- | --- | --- |
| `local` | Development | Developer workstation, Linux with the isolation runtime installed | Seeded fixtures only |
| `ci` | Automated gates | Pipeline runners | Ephemeral; escape suite runs against the real runtime |
| `staging` | Pre-release verification and the nightly evaluation run | One host under our control | Seed repositories, no customer data |
| `production` | A customer's own deployment | The customer's host | The customer's own |

There is no shared production environment we operate. "Production" is whatever the customer installed,
which is why the bootstrap procedure is a first-class deliverable with a time budget
([NFR-020](../01-product/04-non-functional-requirements.md)) rather than an internal runbook.

## Topology

Four long-running processes, the ceiling set by
[NFR-021](../01-product/04-non-functional-requirements.md):

| Process | Role | Restart behaviour |
| --- | --- | --- |
| `api` | HTTP API and the server-rendered run viewer | Stateless; restart freely |
| `worker` | Graph executor, effect handlers, reaper | Holds Run leases; on restart re-acquires and resumes from the event log |
| `postgres` | System of record and checkpoints | Persistent volume; the one stateful component that matters |
| `objectstore` | Content-addressed artifacts (S3-compatible, MinIO) | Persistent volume |

Sandboxes are not processes in this list: they are created and destroyed per Run by the worker through
the sandbox runtime installed on the host.

Deliberately absent, each with the reason: **no message broker** — Postgres `SELECT … FOR UPDATE SKIP
LOCKED` is sufficient at this concurrency and removes a whole component; **no cache** — nothing is
read often enough to need one, and a cache is a second source of truth; **no reverse proxy in the
default install** — the operator terminates TLS with whatever they already run; **no Kubernetes** —
one host, four processes.

Adding a fifth process requires a superseding ADR. That rule exists because process count is the
variable that most reliably predicts whether a solo-operated system stays operated.

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
one first is wasted work.

1. **Sandbox concurrency on one host** binds first: CPU and memory per Sandbox against the host's
   capacity. Response: raise host size, lower per-Sandbox limits, or lower the concurrency cap.
2. **Worker throughput** next: more worker processes against the same Postgres. The lease mechanism
   already permits it; nothing changes except the process count, which is why the lease was designed
   this way despite v1 running one worker.
3. **Sandbox hosts as a pool** third: `SandboxProvider` gains a host-selection step. This is the point
   at which the control plane and the sandbox zone stop sharing a host, which also closes the residual
   risk recorded in [ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md).
4. **Postgres** last, and probably never at this workload. When it binds, read replicas for the viewer
   before anything more exotic.

Multi-tenancy is not on this path — it is a product change, not a scaling one, and it is specified in
[15-future-phase-seams.md](15-future-phase-seams.md).
