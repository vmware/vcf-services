# SupervisorService

A `SupervisorService` installs and manages a [Carvel](https://carvel.dev/) package as a Supervisor Service on a vSphere Supervisor cluster. The controller registers the package with the vCenter Supervisor API, applies installation values, and monitors readiness.

## When to Use

- Deploy a Carvel-packaged application (e.g. Arcturus, TKG, Prometheus) to one or more Supervisor clusters.
- Automate multi-region Supervisor service deployment with consistent configuration.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `region` | string | Yes | VCF region name where the Supervisor resides |
| `supervisor` | string | Yes | Supervisor cluster name |
| `package` | RawExtension | Yes | Carvel `Package` CR definition (inline or via selector) |
| `packageMetadata` | RawExtension | Yes | Carvel `PackageMetadata` CR definition |
| `values` | SupervisorValues | No | Installation values resolved from a Kubernetes resource |
| `access` | []SupervisorAccessGrant | No | Management service access grants for workloads in the Supervisor |
| `readyConditions` | []SupervisorReadyCondition | No | Custom conditions to poll before marking the resource `Healthy` |

### SupervisorValues

Resolves the installation values YAML from another Kubernetes resource:

```yaml
values:
  selector:
    kind: Secret
    labels:
      services.vcfa.broadcom.com/context: install
      services.vcfa.broadcom.com/link-region: us-west-1
    path: data.values
```

### SupervisorAccessGrant

Grants a Supervisor workload type access to a management service:

```yaml
access:
  - type: VSPHERE_POD          # VSPHERE_POD | VIRTUAL_MACHINE | ANY
    managementService: vcf-depot
  - type: VSPHERE_POD
    managementService: vcenter-api
```

### SupervisorReadyCondition

Polls a field in a Supervisor resource before the CR transitions to `Healthy`:

```yaml
readyConditions:
  - name: externalIp
    supervisorSelector:
      kind: Service
      labels:
        app: arcturus
      path: status.loadBalancer.ingress[0].ip
  - name: certificates
    supervisorSelector:
      kind: Secret
      name: arcturus-tls
```

The resolved values are stored in `status.readyConditions` and are available to [Overlay](overlay.md) resources.

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | vCenter Supervisor Service ID |
| `supervisorId` | string | Resolved Supervisor cluster ID |
| `regionId` | string | Resolved region ID |
| `vcenterId` | string | Resolved vCenter ID |
| `namespace` | string | Supervisor namespace where the service is installed |
| `serviceName` | string | Installed service name |
| `serviceVersion` | string | Installed service version |
| `inputValuesHash` | string | Hash of the input values used for change detection |
| `appliedValuesHash` | string | Hash of the values actually applied to the Supervisor |
| `readyConditions` | map[string]string | Resolved ready condition values (keyed by condition name) |

## Lifecycle

```
CR created
    │
    ▼
Busy - resolving values, locating Supervisor Service Bundle
    │
    ▼
Busy - registering Package + PackageMetadata with vCenter Supervisor API
    │
    ▼
Busy - polling readyConditions (if configured)
    │  ↺ every 10 s until all conditions resolve
    ▼
Healthy - service running, externalId populated
    │
    ├─ spec change detected (values hash mismatch)
    │       │
    │       ▼
    │   Busy - re-applying updated values / package
    │       │
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - unregistering service from vCenter
            │
            ▼
        CR removed
```

- If any step fails, the CR transitions to `Unhealthy` with an error in `status.message` and the controller retries with backoff.

## Example

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: SupervisorService
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-install
    services.vcfa.broadcom.com/overlay: install.us-west-1
    services.vcfa.broadcom.com/overlay-apply: eager
spec:
  region: us-west-1
  supervisor: supervisor-vc1
  package:
    apiVersion: data.packaging.carvel.dev/v1alpha1
    kind: Package
    # ...
  packageMetadata:
    apiVersion: data.packaging.carvel.dev/v1alpha1
    kind: PackageMetadata
    # ...
  values:
    selector:
      kind: Secret
      labels:
        services.vcfa.broadcom.com/context: install
        services.vcfa.broadcom.com/link-region: us-west-1
      path: data.values
  access:
    - type: VSPHERE_POD
      managementService: vcf-depot
  readyConditions:
    - name: externalIp
      supervisorSelector:
        kind: Service
        labels:
          app: arcturus
        path: status.loadBalancer.ingress[0].ip
    - name: certificates
      supervisorSelector:
        kind: Secret
        name: arcturus-tls
```
