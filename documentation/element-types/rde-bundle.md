# RdeBundle

An `RdeBundle` deploys a set of Runtime Defined Entity (RDE) type definitions, interfaces, and behaviors into VCF Automation. RDEs extend the VCF Automation data model with custom object types that can be managed through the standard VCF Automation API and protected with fine-grained RBAC. The bundle is distributed as an OCI artifact pulled from a registry.

More background on RDEs and behaviors is available in the [Extensibility Platform Overview](../extensibility-platform/extensibility-platform.md).

## When to Use

- Define custom object types (e.g. `ArcturusProject`, `BackupPolicy`) that are stored in VCF Automation and managed through its API.
- Register MQTT or webhook behaviors that execute when RDE instances are created, updated, or deleted.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `image` | string | Yes | OCI image reference for the RDE bundle artifact |

The bundle artifact is a ZIP or OCI layer that contains RDE type definitions, interface definitions, and behavior specifications in the VCF Automation schema format.

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `vcdRdeTypes` | []string | URNs of all RDE types registered from this bundle |
| `vcdRdeInterfaces` | []string | URNs of all RDE interfaces registered from this bundle |
| `artifactId` | string | Artifact identifier |
| `source` | string | Resolved OCI source URL |
| `sha` | string | SHA digest of the bundle artifact |

## Lifecycle

```
CR created
    │
    ▼
Busy - pulling bundle artifact from OCI repository
    │  ↺ retries with backoff if image is unavailable
    ▼
Busy - registering RDE interfaces in VCF Automation
    │
    ▼
Busy - registering RDE types
    │
    ▼
Busy - registering behaviors (webhook, MQTT, FaaS)
    │
    ▼
Healthy - all types and interfaces registered,
          vcdRdeTypes and vcdRdeInterfaces populated
    │
    ├─ image tag updated (new bundle version)
    │       │
    │       ▼
    │   Busy - re-applying updated type/interface/behavior definitions
    │       │  (additive; existing RDE instances are preserved)
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - de-registering types, interfaces, and behaviors
            │  (only succeeds if no RDE instances exist for these types)
            ▼
        CR removed
```

- RDE type deletion is blocked if RDE instances of that type still exist in VCF Automation. The CR remains in a deletion-pending state until all instances are removed.
- Bundle updates are additive: new fields added to a type definition are applied; removed fields are not automatically removed from existing instances.

## Example

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: RdeBundle
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-rde
spec:
  image: arcturus.example.com/vcf-rdes/arcturus-rde-bundle:1.0.0
```
