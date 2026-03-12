# Compatibility Checks

This guide outlines the compatibility framework for Supervisor Services. By defining these constraints in your Carvel Package YAML, you ensure your service only installs on supported infrastructure, preventing runtime failures and improving the user experience for vSphere administrators.

## Overview of Compatibility Checks

Supervisor Services support the following types of compatibility enforcement:

  - **Severity behavior** – Each check can report `ERROR`, `WARNING`, or `INFO`.

| Severity  | Effect | When to use |
|-----------|--------|-------------|
| `ERROR`   | Pre-check fails; installation/upgrade is blocked. | Environment does not meet a hard requirement (e.g. required capability or API not enabled); block to avoid runtime failure. |
| `WARNING` | Upgrade is allowed; warning is shown. | Admin should be informed but can proceed (e.g. known limitation in this environment). |
| `INFO`    | Upgrade is allowed; informational message is shown. | Optional guidance. |

These checks are evaluated during **Service Installation**, **Service Upgrade**, and **Supervisor Upgrade**.

## Supported Compatibility Criteria

Define these constraints in your Package YAML under `spec` or `metadata.annotations`.

| Criterion | Description | When to use |
|-----------|-------------|-------------|
| [A. Supervisor Version Constraints](#a-supervisor-version-constraints) | Ensure the Supervisor platform version is compatible. | Your service depends on a feature or API that exists only in certain Supervisor versions; block install/upgrade on older releases. |
| [B. Kubernetes Version Selection](#b-kubernetes-version-selection) | Ensure the underlying Kubernetes version meets requirements. | Your manifests or controllers require a minimum Kubernetes API version or behavior (e.g. CRD or admission API). |
| [C. Version Upgrade Constraints](#c-version-upgrade-constraints) | Restrict allowed source or destination versions during upgrade. | You need to enforce upgrade paths (e.g. no skip from v1.0 to v3.0, or limit upgrades from a given version to a range). |
| [D. Runtime Pre-check Hooks](#d-advanced-runtime-pre-check-hooks) | Custom HTTP hook using the same severity-level reporting as platform pre-checks. | Compatibility cannot be expressed by version or capability alone (e.g. check DB reachability, storage, or custom env state before upgrade). |

### A. Supervisor Version Constraints

It ensures your service runs on a compatible version of the Supervisor platform.

- **Impact:** Blocking for Install/Upgrade.
- **Implementation:** Add the annotation to your Package metadata.

```yaml
metadata:
  annotations:
    # Example: Requires Supervisor version 9.2.0.0 or higher
    appplatform.vmware.com/supervisor-version-constraints: ">=9.2.0.0"
```

### B. Kubernetes Version Selection

Ensures the Supervisor's underlying Kubernetes version meets your application requirements.

- **Impact:** Blocking for Install/Upgrade.
- **Implementation:** Define in the `spec` of the Package; the version must follow semantic versioning.

```yaml
spec:
  kubernetesVersionSelection:
    constraints: ">1.30.0"
```

### C. Version Upgrade Constraints

Two annotations control which upgrades are allowed by restricting either the source (installed) version or the target version.

- **Impact:** Blocking (upgrade only).
- **Implementation:** Add one or both annotations to your Package metadata. Both use the same constraint expression format (e.g. semver ranges like `>=1.5.0`, `>1.0.0 <2.0.0`, or `(> 1.2.1 && < 1.3.0) || >= 1.3.1`).

#### 1. Source version upgrade constraints

Restricts which installed versions can upgrade to this package (e.g. only allow upgrade to v2.0 if the user is already on v1.5+). The annotation lives on the **target** package; the constraint is evaluated against the installed (source) version.

#### 2. Destination version upgrade constraints

Restricts which target versions this installed version can upgrade to (e.g. from v1.0 you may only be allowed to upgrade to versions &lt; 2.0.0). The annotation lives on the **installed (source)** package; the constraint is evaluated against the target version.

**Example:** This version may only be upgraded **from** a version &gt; 1.0.0 and may only be upgraded **to** a version &lt; 3.0.0. Add one or both annotations to your Package metadata:

```yaml
metadata:
  annotations:
    # Only allow upgrade to this version if the installed version is > 1.0.0
    appplatform.vmware.com/source-version-upgrade-constraints: ">1.0.0"
    # From this version, only allow upgrade to a version < 3.0.0
    appplatform.vmware.com/destination-version-upgrade-constraints: "<3.0.0"
```

### D. Advanced: Runtime Pre-check Hooks

If your compatibility logic cannot be expressed as a simple version string (e.g., you need to check if a specific database is reachable or if enough storage remains), you can use an **Upgrade Pre-check Hook**.

The Supervisor calls a specific HTTP endpoint in your service before an upgrade starts. The endpoint must return results using the same **severity-level reporting** (ERROR, WARNING, INFO) as the general platform pre-checks. You must implement a web server that fulfills the API contract below; adding the compatibility-check annotations to your Package metadata alone is not sufficient.

```yaml
metadata:
  annotations:
    # Pre-check hook: service to validate environment health before upgrade
    appplatform.vmware.com/compatibility-check_service: upgrade-compatibility-service
    appplatform.vmware.com/compatibility-check_port: "80"
    appplatform.vmware.com/compatibility-check_protocol: https
    appplatform.vmware.com/compatibility-check_url: ucs/v2/compatibility
    appplatform.vmware.com/compatibility-check_method: POST
    # Secret containing the "ca.cert" field for SSL verification
    appplatform.vmware.com/compatibility-check_ca_secret: ucs-service-ca-cert
    # Data sent in the POST request body (e.g., cluster identifiers or states)
    appplatform.vmware.com/compatibility-check_data: |
      {
        "check": "storage-migration-ready",
        "timeout": "60s"
      }
```

- **Response**

Body (JSON)

Root object:

| Field     | Type  | Required | Description |
|-----------|--------|----------|-------------|
| `results` | array | Yes      | List of pre-check result items |

Each element in `results`:

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `severity` | string | Yes      | One of `ERROR`, `WARNING`, or `INFO` (case-insensitive). `ERROR` marks the upgrade as incompatible. |
| `message`  | string | Yes      | Human-readable message shown to the user. |

Example

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

Empty / success

Compatible upgrade with no messages:

```json
{
  "results": []
}
```
