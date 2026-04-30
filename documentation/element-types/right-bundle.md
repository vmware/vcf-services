# RightBundle

A `RightBundle` groups a set of custom rights into a named bundle that organisational administrators can use to compose roles. Unlike [GlobalRole](global-role.md), a `RightBundle` is not automatically assigned to any role - it is a palette of rights made available to administrators for manual inclusion in their custom roles.

## When to Use

- Bundle the RDE-based rights created by a [RdeBundle](rde-bundle.md) so that tenant admins can create service-specific roles.
- Package API extension rights that should be optionally granted to users.
- Create reusable permission sets that multiple roles can share.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `name` | string | Yes | Display name of the right bundle in VCF Automation |
| `description` | string | No | Human-readable description |
| `rights` | []string | No | List of right identifiers to include |
| `scope` | ResourceScope | No | Controls which tenant organisations can see the bundle |

### Rights Format

Rights are typically RDE-based or custom rights introduced by the service:

- `broadcom:arcturusProject: View`
- `broadcom:arcturusProject: Modify`
- `broadcom:arcturusProject: Full Control`

### ResourceScope

```yaml
scope:
  allTenants: true      # make available to all organisations
```

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | VCF Automation right bundle ID (URN) |

## Lifecycle

```
CR created
    │
    ▼
Busy - creating right bundle in VCF Automation
    │  Resolving right identifiers
    ▼
Busy - publishing bundle to tenant organisations per scope
    │
    ▼
Healthy - bundle created, externalId populated
    │
    ├─ rights or scope updated
    │       │
    │       ▼
    │   Busy - updating bundle
    │       │
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - removing bundle from VCF Automation
            │
            ▼
        CR removed
```

- Right bundles cannot be deleted from VCF Automation while a custom role references them.
- If a right identifier is invalid or not registered, the CR transitions to `Unhealthy`.

## Example

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: RightBundle
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-rights
spec:
  name: arcturusRightsBundle
  description: Custom rights for Arcturus registry management
  rights:
    - 'broadcom:arcturusProject: View'
    - 'broadcom:arcturusProject: Modify'
    - 'broadcom:arcturusProject: Full Control'
    - 'broadcom:arcturusUser: View'
    - 'broadcom:arcturusUser: Modify'
  scope:
    allTenants: true
```
