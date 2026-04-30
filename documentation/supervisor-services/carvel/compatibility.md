# Compatibility Checks

This guide outlines the compatibility framework for Supervisor Services. By defining these constraints in your Carvel Package YAML, you ensure your service only installs on supported infrastructure, preventing runtime failures and improving the user experience for vSphere administrators.

## Overview of Compatibility Checks

Supervisor Services support compatibility enforcement through **severity-based reporting**. Each check can report one of three severity levels:

| Severity  | Effect | When to use |
|-----------|--------|-------------|
| `ERROR`   | Pre-check fails; installation or upgrade is blocked. | Environment does not meet a hard requirement (e.g. required capability or API not enabled); block to avoid runtime failure. |
| `WARNING` | Installation or upgrade is allowed; a warning is shown to the admin. | Admin should be informed but can proceed (e.g. known limitation in this environment). |
| `INFO`    | Installation or upgrade is allowed; an informational message is shown. | Optional guidance. |

These checks are evaluated during **Service Installation**, **Service Upgrade**, and **Supervisor Upgrade**.

## Constraint Types

A Supervisor Service Carvel Package can declare different types of version constraints:

| Constraint | Where you set it | Checked against | When to use |
|------------|------------------|-----------------|-------------|
| [Supervisor version](#a-supervisor-version-constraints) | `appplatform.vmware.com/supervisor-version-constraints` annotation | The Supervisor release version | Your service depends on a feature or API that exists only in certain Supervisor versions; block install/upgrade on older releases. |
| [Kubernetes version](#b-kubernetes-version-selection) | `spec.kubernetesVersionSelection.constraints` | The Supervisor's Kubernetes version | Your manifests or controllers require a minimum Kubernetes API version or behavior (e.g. CRD or admission API). |
| [Source upgrade version](#1-source-version-upgrade-constraints) | `appplatform.vmware.com/source-version-upgrade-constraints` annotation | The currently installed version of your service (when upgrading) | Enforce upgrade paths — e.g. require users to be on v1.5+ before they can move to v2.0. |
| [Destination upgrade version](#2-destination-version-upgrade-constraints) | `appplatform.vmware.com/destination-version-upgrade-constraints` annotation | The target version of your service (when upgrading) | Block known-bad upgrade jumps — e.g. from v1.0 don't allow upgrading directly to v3.0. |

For compatibility logic that **cannot** be expressed as a version constraint (e.g. "is database X reachable?"), see [Advanced: Runtime Pre-check Hook](#advanced-runtime-pre-check-hook).

> **Heads up:** Supervisor versions have four numeric segments (e.g. `9.0.0.0`) and are not strict SemVer. To accommodate this, the Supervisor version constraint accepts a slightly different syntax than the other three. See [Syntax A](#syntax-a--kubernetes--source--destination-version-constraints) and [Syntax B](#syntax-b--supervisor-version-constraints) below.

## Constraint Expression Syntax

Constraints are validated when you register or update the service; an invalid expression causes the API call to fail with the offending string echoed back. An empty constraint string means "always compatible".

The platform uses two different parsers depending on the constraint type, so the syntaxes differ in small but important ways.

### Syntax A — Kubernetes / source / destination version constraints

Parsed by [`blang/semver`'s `ParseRange`](https://pkg.go.dev/github.com/blang/semver#ParseRange); see that page for the full grammar. Versions must follow [Semantic Versioning](https://semver.org/).

Quick cheat sheet:

- **Operators:** `=` / `==` (default), `!=` / `!`, `>`, `<`, `>=`, `<=`.
- **Combinators:** whitespace = AND, `||` = OR. AND binds tighter than OR; there is no grouping with `( )`.
- **Wildcards:** lowercase `x` may stand in for one segment — `1.2.x` ≡ `>=1.2.0 <1.3.0`, `1.x` ≡ `>=1.0.0 <2.0.0`. Capital `X` and a bare `*` are not recognized.
- **Not supported:** `&&`, hyphen ranges (`1.0.0 - 2.0.0`), tilde (`~1.2.3`), caret (`^1.2.3`). Express these as explicit ranges.

**Examples:**

| Expression | Meaning |
|------------|---------|
| `>=1.5.0` | 1.5.0 or any later version |
| `>1.0.0 <2.0.0` | Greater than 1.0.0 **and** less than 2.0.0 |
| `>=1.5.0 <2.0.0 \|\| >=2.1.0` | At least 1.5.0 and below 2.0.0, **or** at least 2.1.0 |
| `1.2.x` | Any 1.2.* version |

### Syntax B — Supervisor version constraints

Parsed by [`hashicorp/go-version`'s `NewConstraint`](https://pkg.go.dev/github.com/hashicorp/go-version#NewConstraint); see that page for the full grammar. Supervisor versions are not strict SemVer (they have four numeric segments, e.g. `9.0.0.0`), so this parser is used instead of Syntax A.

Quick cheat sheet:

- **Operators:** `=` (default), `!=`, `>`, `<`, `>=`, `<=`, `~>` (pessimistic — `~>9.0.1` ≡ `≥ 9.0.1, <9.1.0`).
- **Combinator:** `,` = AND. There is no OR, no grouping, and `==` is not accepted.
- **Versions** can have any number of segments; missing segments are treated as zero (`>9.0`, `>9.0.0`, and `>9.0.0.0` are all valid).

**Examples:**

| Expression | Meaning |
|------------|---------|
| `>=9.0.0.0` | 9.0.0.0 or later |
| `>9.0.0.0, <9.1.0.0` | Strictly between 9.0.0.0 and 9.1.0.0 |
| `~>9.0.1` | At least 9.0.1 and less than 9.1 |

## Defining Constraints

### A. Supervisor Version Constraints

Ensures your service runs on a compatible Supervisor release. Uses [Syntax B](#syntax-b--supervisor-version-constraints).

- **Impact:** Blocking for Install/Upgrade.
- **Implementation:** Add the annotation to your Package metadata.

```yaml
metadata:
  annotations:
    # Example: Requires Supervisor 9.2.0.0 or later
    appplatform.vmware.com/supervisor-version-constraints: ">=9.2.0.0"
```

### B. Kubernetes Version Selection

Ensures the Supervisor's underlying Kubernetes version meets your application requirements. Uses [Syntax A](#syntax-a--kubernetes--source--destination-version-constraints).

- **Impact:** Blocking for Install/Upgrade.
- **Implementation:** Define in the `spec` of the Package.

```yaml
spec:
  kubernetesVersionSelection:
    constraints: ">=1.30.0"
```

### C. Version Upgrade Constraints

Two annotations control which upgrades are allowed by restricting either the source (installed) version or the target version. Both use [Syntax A](#syntax-a--kubernetes--source--destination-version-constraints).

- `appplatform.vmware.com/source-version-upgrade-constraints` – limits the **installed** (source) versions that can upgrade to this package.
- `appplatform.vmware.com/destination-version-upgrade-constraints` – limits the **target** versions that can be upgraded to from this installed version.

- **Impact:** Blocking (upgrade only).
- **Implementation:** Add one or both annotations to your Package metadata.

#### 1. Source version upgrade constraints

Restricts which installed versions can upgrade to this package (e.g. only allow upgrade to v2.0 if the user is already on v1.5+). The `appplatform.vmware.com/source-version-upgrade-constraints` annotation lives on the **target** package; the constraint is evaluated against the installed (source) version.

**Example:** This v2.0.0 package may only be installed as an upgrade from v1.5.0 or later:

```yaml
# In the v2.0.0 Package
metadata:
  annotations:
    # Only allow upgrade to this version if the installed version is >= 1.5.0
    appplatform.vmware.com/source-version-upgrade-constraints: ">=1.5.0"
```

#### 2. Destination version upgrade constraints

Restricts which target versions this installed version can upgrade to (e.g. from v1.0 you may only be allowed to upgrade to versions &lt; 2.0.0). The `appplatform.vmware.com/destination-version-upgrade-constraints` annotation lives on the **installed (source)** package; the constraint is evaluated against the target version.

**Example:** From v1.0.0, only allow upgrade to versions less than 2.0.0:

```yaml
# In the v1.0.0 Package
metadata:
  annotations:
    # From this version, only allow upgrade to a version < 2.0.0
    appplatform.vmware.com/destination-version-upgrade-constraints: "<2.0.0"
```

**Combined example:** This package may only be upgraded **from** a version &gt; 1.0.0 and may only be upgraded **to** a version &lt; 3.0.0. Add one or both annotations to your Package metadata:

```yaml
metadata:
  annotations:
    appplatform.vmware.com/source-version-upgrade-constraints: ">1.0.0"
    appplatform.vmware.com/destination-version-upgrade-constraints: "<3.0.0"
```

## Advanced: Runtime Pre-check Hook

If your compatibility logic cannot be expressed as a simple version constraint (e.g., you need to verify that a backing database is reachable, that enough storage remains, or that a custom resource is in a particular state), you can register an **Upgrade Pre-check Hook**. Before an upgrade starts, the Supervisor will call an HTTP(S) endpoint that you expose, and your endpoint returns a list of results using the same severity model (ERROR, WARNING, INFO) as the built-in platform pre-checks.

You must implement an in-cluster web server that fulfills the API contract below. Adding the annotations to your Package alone is not sufficient — without an endpoint to call, the upgrade pre-check will fail.

### How the hook is dispatched

When a user requests an upgrade from `sourceVersion` to `targetVersion` of your service, the Supervisor:

1. **Reads the routing annotations** from the **source version's** Package to discover where to send the request (service, port, protocol, URL path, method, CA secret).
2. **Reads the `_data` annotation** from the **target version's** Package and uses its value as the request body.
3. **Issues the HTTP(S) request** to your endpoint, using the routing details from step 1 and the body from step 2.
4. **Parses the JSON response** and merges the results into the overall pre-check report.

The endpoint must be backed by a Kubernetes Service in the same namespace as your Supervisor Service so that the Supervisor can reach it.

### Annotations

All annotations live on the Carvel Package metadata.

| Annotation | Read from | Required | Default | Notes |
|------------|-----------|----------|---------|-------|
| `appplatform.vmware.com/compatibility-check_service` | source version | Yes | — | Name of the Kubernetes Service to call |
| `appplatform.vmware.com/compatibility-check_url` | source version | Yes | — | Path appended after `host:port/`. Do not include a leading `/`. |
| `appplatform.vmware.com/compatibility-check_port` | source version | No | `80` | TCP port on the Service |
| `appplatform.vmware.com/compatibility-check_protocol` | source version | No | `http` | `http` or `https` (case-insensitive) |
| `appplatform.vmware.com/compatibility-check_method` | source version | No | `GET` | Only `GET` or `POST` are accepted |
| `appplatform.vmware.com/compatibility-check_ca_secret` | source version | If `protocol: https` | — | Name of a Secret in your service's namespace; the Supervisor reads its `ca.crt` field to build the trust pool |
| `appplatform.vmware.com/compatibility-check_data` | target version | No | empty | Sent verbatim as the request body (with `Content-Type: application/json`) for both GET and POST |

> **Tip:** Because `_data` is sourced from the target version's Package, you can ship new payload fields alongside a new release without changing previously installed versions.

### Transport choices

- **`http`** — plaintext. Suitable for a Service that lives in the same cluster and is not exposed beyond it.
- **`https`** — TLS-protected. You must ship a Secret containing a `ca.crt` field that the Supervisor will use as the root of trust, and reference it via `_ca_secret`. The Supervisor only validates the server certificate against this CA bundle; it does not present a client certificate.

### Example

```yaml
metadata:
  annotations:
    # Where to send the pre-check request
    appplatform.vmware.com/compatibility-check_service: upgrade-compatibility-service
    appplatform.vmware.com/compatibility-check_port: "443"
    appplatform.vmware.com/compatibility-check_protocol: https
    appplatform.vmware.com/compatibility-check_url: ucs/v2/compatibility
    appplatform.vmware.com/compatibility-check_method: POST
    # Secret in the service's namespace; must contain a "ca.crt" field
    appplatform.vmware.com/compatibility-check_ca_secret: ucs-service-ca-cert
    # Body sent in the request (read from the TARGET version's package)
    appplatform.vmware.com/compatibility-check_data: |
      {
        "check": "storage-migration-ready",
        "timeout": "60s"
      }
```

### Response contract

#### HTTP status

- **`200 OK`** — body is parsed as JSON (see below).
- **Anything else** — the pre-check fails the upgrade and the response body is surfaced as an error.

#### Body (JSON)

**Root object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `results` | array | Yes | List of pre-check result items. May be empty. |

**Each element of `results`:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `severity` | string | Yes | One of `ERROR`, `WARNING`, `INFO` (case-insensitive). Other values are silently ignored. |
| `message` | string | Yes | Human-readable text shown to the user in the upgrade pre-check report. |

**Semantics:**

- Any entry with `severity: ERROR` marks the upgrade as incompatible (blocks the upgrade unless the user overrides).
- `WARNING` and `INFO` are surfaced to the user but do not block the upgrade.
- An empty `results` array (or a response with no `ERROR` entries) means compatible.

#### Examples

**A run that surfaces a warning and an info note but allows the upgrade:**

```json
{
  "results": [
    {
      "severity": "WARNING",
      "message": "Custom resource X will be deprecated in the target version."
    },
    {
      "severity": "INFO",
      "message": "No breaking changes detected."
    }
  ]
}
```

**A clean run with no messages:**

```json
{ "results": [] }
```

**A run that blocks the upgrade:**

```json
{
  "results": [
    {
      "severity": "ERROR",
      "message": "Migration prerequisite missing: backing PVC is not bound."
    }
  ]
}
```

### Troubleshooting the Pre-check Hook

If the hook is misconfigured or your endpoint misbehaves, the platform treats the pre-check as a failure and blocks the upgrade. The error text returned by your endpoint (or by the platform if the call never reached you) is surfaced to the user in the upgrade pre-check report. As a service developer, the most useful diagnostic is the response your own endpoint emits — log the full incoming request and the JSON body you return so you can reproduce what the user sees in the pre-check report.

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| Pre-check times out or reports "endpoint unreachable" / DNS failure | Wrong `_service` name, wrong `_port`, the backing Pod is not Ready, or the Service is in the wrong namespace. | The Supervisor resolves the endpoint as `<_service>.<your-service-namespace>.svc.cluster.local:<_port>`. Confirm: (1) a Kubernetes Service with that name exists in the same namespace as your Supervisor Service, (2) `_port` matches one of its `ports[].port`, and (3) at least one selected Pod is Ready. |
| TLS / certificate error when `_protocol: https` | Missing `_ca_secret`, the Secret doesn't exist in your service's namespace, or it has no `ca.crt` field. | The Supervisor reads the `ca.crt` key (not `ca.cert`) of the referenced Secret and uses it as the only root of trust. Verify the Secret exists in your Supervisor Service's namespace, contains a PEM-encoded `ca.crt` entry, and that this CA actually issued the server certificate your endpoint presents (including matching SANs for `<_service>.<namespace>.svc.cluster.local`). |
| "method ... not supported" error at registration / call time | `_method` was set to something other than GET or POST. | Only GET and POST are accepted (case-insensitive). Omit the annotation to default to GET. |
| "CA cert must be provided if using HTTPS" | `_protocol: https` was set but `_ca_secret` was omitted. | Either add `_ca_secret`, or drop the `_protocol` annotation to fall back to plain http. |
| "Invalid response body" / JSON parse error | The endpoint returned non-JSON (e.g. an HTML error page) or the JSON did not match the contract. | Return a JSON body with a top-level `results` array. Each item must include `severity` (ERROR, WARNING, or INFO — case-insensitive) and `message`. Items with any other severity are silently dropped. |
| Non-2xx HTTP status from the endpoint | Endpoint returned 4xx/5xx. | The platform treats any non-200 response as a hard failure and surfaces the response body verbatim as the error. Always return `200 OK` with the JSON body, and signal incompatibility via `severity: ERROR` items rather than HTTP error codes. |
| Endpoint receives a request it considers unauthenticated | Your handler rejects the call because it doesn't recognize the caller. | The Supervisor includes an `Authorization: Bearer <token>` header (a Supervisor ServiceAccount token) and `Content-Type: application/json`. If you authenticate callers, accept that token (for example via `TokenReview`) or otherwise trust requests originating from that ServiceAccount. |
| Request body is empty when the endpoint expected one | The `_data` annotation was placed on the wrong Package version. | `_data` is read from the **target** version's Package, not the source. If users are upgrading to a version whose Package omits `_data`, the body is empty. The other annotations (`_service`, `_port`, `_protocol`, `_url`, `_method`, `_ca_secret`) are read from the **source** version's Package. |
| Upgrade blocked with a message you didn't expect | Your endpoint returned a `severity: ERROR` item. | Inspect the `message` field; that text is the user-visible reason the upgrade is blocked. A response with no ERROR items (including an empty `results: []`) is treated as compatible. |
| Pre-check fails before your endpoint is ever called | The source or target Package could not be loaded, or the service's namespace could not be resolved. | Confirm both the source-version and target-version Package resources exist for your service, and that the service is properly installed (so its namespace is discoverable). These show up as 400/500 responses from the operator before any outbound call is made. |


