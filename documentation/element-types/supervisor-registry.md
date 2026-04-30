# SupervisorRegistry

A `SupervisorRegistry` configures a container image registry on a vSphere Supervisor cluster. The controller registers the registry endpoint, certificates, and optional credentials with the Supervisor so that workloads running on that cluster can pull images without additional configuration.

## When to Use

- Register a regional Arcturus instance as the default registry for a Supervisor cluster.
- Add a private registry with TLS certificates and credentials.
- Set up multiple registries per Supervisor with different trust levels.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `region` | string | Yes | VCF region name |
| `supervisor` | string | Yes | Supervisor cluster name |
| `endpoint` | string | Yes | Registry endpoint - hostname, `hostname:port`, or FQDN |
| `certificates` | string | No | PEM-encoded CA certificate chain used to trust the registry TLS |
| `username` | string | No | Registry username for authenticated pulls |
| `password` | PasswordSelector | No | Registry password resolved from a Kubernetes Secret |
| `defaultRegistry` | boolean | No | When `true`, sets this registry as the default for the Supervisor |

### PasswordSelector

Resolves the registry password from a field in a Kubernetes Secret at reconciliation time:

```yaml
password:
  selector:
    kind: Secret
    labels:
      services.vcfa.broadcom.com/context: install
      services.vcfa.broadcom.com/link-region: us-west-1
    path: data.values.arcturusAdminPassword
```

The `selector` is a [PathSelector](element-types-overview.md#pathselector) - it locates the Secret by label and extracts the value at the given JSONPath.

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `supervisorId` | string | Resolved Supervisor cluster ID where the registry was registered |

## Lifecycle

```
CR created
    │
    ▼
Busy - resolving password from selector (if configured)
    │
    ▼
Busy - registering registry endpoint with Supervisor
    │  (TLS certificates and credentials submitted to vCenter API)
    ▼
Healthy - registry active on Supervisor, supervisorId populated
    │
    ├─ spec change detected (endpoint, certificates, or password updated)
    │       │
    │       ▼
    │   Busy - updating registry registration on Supervisor
    │       │
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - de-registering registry from Supervisor
            │
            ▼
        CR removed
```

- If the password selector cannot resolve (e.g. the target Secret does not yet exist), the CR remains `Busy` and retries every 10 seconds.
- Only one registry per endpoint can be marked as `defaultRegistry` on a given Supervisor; attempting to set a second default will produce an `Unhealthy` state with a conflict error.

## Example

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: SupervisorRegistry
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-registry
    services.vcfa.broadcom.com/overlay: consume.us-west-1
    services.vcfa.broadcom.com/overlay-apply: eager
spec:
  region: us-west-1
  supervisor: supervisor-vc1
  endpoint: arcturus.corp.home.svc:5000
  certificates: |
    -----BEGIN CERTIFICATE-----
    MIIDXTCCAkWgAwIBAgIJAKZ...
    -----END CERTIFICATE-----
  username: admin
  password:
    selector:
      kind: Secret
      labels:
        services.vcfa.broadcom.com/context: install
        services.vcfa.broadcom.com/link-region: us-west-1
      path: data.values.arcturusAdminPassword
  defaultRegistry: true
```
