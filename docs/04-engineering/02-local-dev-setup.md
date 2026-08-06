# Local development setup

The same procedure an operator follows to install the system, with development extras. Keeping them
the same is deliberate: a bootstrap that only the author can run is how a self-hosted product fails
its first install, and [NFR-020](../01-product/04-non-functional-requirements.md) puts a measured
budget on it — 30 minutes and 15 commands from a clean host to a passing smoke test.

## Prerequisites

| Requirement | Why |
| --- | --- |
| Linux with a container runtime | The isolation runtime is Linux-only. macOS and Windows are not supported for running Sandboxes; see below |
| The gVisor runtime (`runsc`) installed and registered with the container runtime | The isolation boundary ([ADR-0005](../03-adr/0005-gvisor-v1-firecracker-deferred.md)). Without it the system refuses to execute ([FR-055](../01-product/03-functional-requirements.md)) |
| Python 3.12 and `uv` | [ADR-0001](../03-adr/0001-python-312-orchestrator-language.md) |
| `make`, `git` | Entry point and version control |
| At least one reachable model endpoint per tier | The system refuses to start otherwise ([FR-046](../01-product/03-functional-requirements.md)) |

**macOS and Windows developers** can run unit, contract and replay suites against the fake sandbox
provider, and cannot run the integration, escape or evaluation suites. Those require Linux with the
isolation runtime, so use a Linux VM or a remote host. This is stated plainly because discovering it
after an hour of setup is a bad first day.

> **Open question OQ-08** — The supported host matrix, including whether the isolation runtime works
> under an unprivileged Proxmox LXC guest or requires a full VM. Recorded in
> [11-infrastructure-and-devops.md](../02-architecture/11-infrastructure-and-devops.md). **Blocks:**
> the preflight check in `make bootstrap` and the published requirements (backlog `INFRA-02`).

## Bootstrap

```bash
git clone <repo> && cd made
make bootstrap        # preflight checks, uv sync, pre-commit hooks, .env from template
$EDITOR .env          # set model endpoints per tier and a repository credential
make up               # start postgres, objectstore, api, worker
make migrate          # apply migrations
make seed             # register the demo Project against tests/fixtures/repos/demo-fastapi
make smoke            # end-to-end Run against the demo Project using the fake model provider
```

`make bootstrap` fails loudly on a missing prerequisite and names it. It does **not** install the
isolation runtime automatically: that requires root and touches the container runtime's daemon
configuration, and a bootstrap script that silently reconfigures a daemon on someone's host is not
something a security-conscious operator should accept. It prints the exact commands instead.

`make smoke` uses the fake model provider by default, so a first run costs nothing and proves the
plumbing — sandbox, database, graph, event log, viewer — without an API key. Add `MODELS=real` to run
it against the configured endpoints.

## Verifying isolation before anything else

Do this before writing code. If the boundary is not real, nothing built on top of it is meaningful.

```bash
make verify-isolation   # asserts the runtime is present, registered, and actually in use
make escape             # the full escape suite against the real runtime
```

`make verify-isolation` creates a Sandbox and confirms from inside it that the isolation runtime is in
effect, rather than trusting configuration. The check exists because a misconfigured runtime silently
falls back to the default one, and every other test still passes
([04-execution-isolation.md](../02-architecture/04-execution-isolation.md)).

## Seed data

`make seed` registers one Project pointing at `tests/fixtures/repos/demo-fastapi`, a small synthetic
repository with a real test suite, a passing baseline command, and a Dockerfile so that `iac` Tasks
have something to verify. Its baseline must pass, or registration is refused
([FR-004](../01-product/03-functional-requirements.md)) — which also makes it a useful check that the
sandbox image is correct.

Additional fixtures used by the evaluation harness live under `tests/fixtures/repos/`, including the
adversarial repository containing prompt-injection text in a README and a test docstring
([FR-078](../01-product/03-functional-requirements.md)). Do not "clean up" that content: it is the
test.

## Common tasks

| Command | Does |
| --- | --- |
| `make test` | Unit, contract and replay suites. Fast, no network, no Sandbox |
| `make test-int` | Integration against real Postgres and a real Sandbox |
| `make escape` | The escape suite. Release-blocking ([NFR-002](../01-product/04-non-functional-requirements.md)) |
| `make eval` | Golden-task harness against the configured tiers. Costs money on hosted endpoints |
| `make eval-compare` | Compares the last harness result against `eval/baseline.json` |
| `make run REQUEST="..."` | Starts a Run against the demo Project from the CLI |
| `make logs` / `make ps` | Process output and status |
| `make migrate` / `make migrate-new NAME=...` | Apply / scaffold a migration |
| `make spec-lint` | Contract, link and vocabulary checks ([ADR-0018](../03-adr/0018-spec-as-contract-and-spec-lint.md)) |
| `make fmt` / `make lint` / `make types` | Formatter, linter, `mypy --strict` |
| `make backup` / `make restore` | Database dump plus object-store copy, and the reverse |
| `make pause` | Stop accepting new Runs; in-flight Runs park. First step of incident response |

If a task is not a Make target, it is undocumented in practice. Add the target with the change.

## Troubleshooting

Real symptoms, in the order they are likely to occur on a first setup.

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `make bootstrap` fails at the preflight with "isolation runtime not registered" | `runsc` installed but not added to the container runtime configuration, or the daemon was not restarted | Add the runtime entry, restart the daemon, re-run. Do not proceed without this |
| `verify-isolation` reports the default runtime in use | The runtime name in configuration does not match the registered name | Match the names exactly; the check compares what is registered against what was requested |
| Sandbox creation times out on first use | Image not present locally; it is being pulled | Pre-pull the pinned image. Subsequent creations meet [NFR-001](../01-product/04-non-functional-requirements.md) |
| The API refuses to start with "tier EDIT has no configured endpoint" | Working as designed ([FR-046](../01-product/03-functional-requirements.md)) | Configure every tier in `.env` |
| Every Run fails immediately with `sandbox_runtime_unavailable` | Fail-closed behaviour, working as designed | Fix the runtime; there is no override |
| Project registration fails with `baseline_verification_failed` | The declared baseline command does not pass on the base branch, or is missing from the sandbox image | Fix the command, or rebuild the image with the dependency ([ADR-0006](../03-adr/0006-no-network-in-verification-sandbox.md)) |
| A Task fails with a missing module the code clearly imports | The dependency is not in the sandbox image, and there is no run-time installation | Rebuild the image and re-pin the digest. This will be the most common confusing failure |
| Verification passes locally, fails in the Sandbox | Local environment has a package or environment variable the image does not | The Sandbox is the truth; align the image |
| Replay tests fail after a routing change | A routing predicate reads the clock or performs IO | Remove it. Time enters as an event ([ADR-0002](../03-adr/0002-langgraph-as-executor-with-pure-routing.md)) |
| Cached-token ratio drops to zero | Something variable entered the stable prefix — a timestamp, a run id, a shuffled tool order | Diff the assembled prefix across two calls; the first differing byte is the cause ([08-context-and-retrieval.md](../02-architecture/08-context-and-retrieval.md)) |
| Costs far above expectation on a failing Run | The progress oracle is not stopping retries, usually because the normaliser is leaving variable text in the signature | Inspect two consecutive `failure_signature` values; if they differ on identical failures, fix `context/normalise.py` |
| A Run is stuck with no events for minutes | Worker died holding a lease | Check worker liveness; the lease expires and another worker resumes ([FR-017](../01-product/03-functional-requirements.md)). If it does not, that is alert 4 |
| Sandboxes accumulate on the host | Reaper not running or failing | `make ps`, check reaper logs; this is alert 5 and INV-7 |
