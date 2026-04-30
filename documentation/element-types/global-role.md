# GlobalRole

A `GlobalRole` creates a VCF Automation role that bundles custom and built-in rights and is automatically distributed to all tenant organisations (or a configured subset). Use it to define service-specific roles that end users and administrators need in order to interact with the service's custom resources and APIs.

## When to Use

- Create a "Arcturus Administrator" role for managing Arcturus projects and users across all tenants.
- Define a "Backup Operator" role for backup service management.
- Distribute a read-only "Monitoring Viewer" role to all tenant organisations.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `name` | string | Yes | Display name of the role in VCF Automation |
| `description` | string | No | Human-readable description |
| `rights` | []string | No | List of right identifiers to include in the role |
| `scope` | ResourceScope | No | Controls which tenant organisations receive the role |

### Rights Format

Rights can be expressed as:

- Built-in VCF Automation rights: `RIGHT_ORGANIZATION_VIEW`
- Custom rights created by a [RightBundle](right-bundle.md): `urn:vcloud:type:broadcom:arcturus_admin`
- RDE-based rights: `broadcom:arcturusBinding: View`

### ResourceScope

```yaml
scope:
  allTenants: true      # distribute to all organisations
```

When `allTenants` is `true`, `tenants` is ignored. When `allTenants` is `false`, only the organisations listed in `tenants` receive the role.

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | VCF Automation role ID (URN) |
| `rights` | []string | Resolved list of rights actually applied to the role |

## Lifecycle

```
CR created
    │
    ▼
Busy - creating role in VCF Automation
    │  Resolving right identifiers
    ▼
Busy - publishing role to tenant organisations per scope
    │
    ▼
Healthy - role created, externalId populated,
          status.rights reflects resolved rights
    │
    ├─ rights or scope updated
    │       │
    │       ▼
    │   Busy - updating role and re-publishing to tenants
    │       │
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - removing role from VCF Automation
            │
            ▼
        CR removed
```

- If a right identifier is not found, the CR transitions to `Unhealthy`.
- The `status.rights` field reflects the rights as resolved and stored in VCF Automation, which may differ from the spec if transitive right implications are applied.

## Example

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: GlobalRole
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-admin
spec:
  name: Arcturus Administrator
  description: >-
    Administrative role for Arcturus registry management.
    Allows full control over Arcturus configuration, projects, and users.
  rights:
    - urn:vcloud:type:broadcom:arcturus_project
    - urn:vcloud:type:broadcom:arcturus_project:admin
    - urn:vcloud:type:broadcom:arcturus_user
    - urn:vcloud:type:broadcom:arcturus_user:admin
    - RIGHT_ORGANIZATION_VIEW
    - RIGHT_ORG_TRAVERSE
  scope:
    allTenants: true
```
