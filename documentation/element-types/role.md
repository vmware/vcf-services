# Role

A `Role` creates a VCF Automation role scoped to a single organisation - typically the provider organisation. It is the building block for granting a [VcfaServiceAccount](vcfa-service-account.md) the permissions it needs to call VCF Automation APIs on behalf of the service.

## When to Use

- Create a provider-scoped service account role for a service backend that needs API access.
- Define automation roles for CI/CD pipelines or integration tools.
- Create limited-permission roles for external systems that interact with a specific organisation.

## Difference from GlobalRole

| | `Role` | `GlobalRole` |
| :---- | :---- | :---- |
| Scope | Single organisation | All tenants (or a list of tenants) |
| Typical use | Service account permissions | End-user or admin roles |
| Auto-published to tenants | No | Yes |

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `name` | string | Yes | Display name of the role in VCF Automation |
| `description` | string | No | Human-readable description |
| `rights` | []string | No | List of right identifiers |
| `organization` | string | No | Organisation name; defaults to the provider (`System`) organisation |

### Rights Format

Rights can be expressed as:

- Built-in VCF Automation rights: `RIGHT_AUTOMATION_PROJECT_VIEW`
- Custom rights: `urn:vcloud:type:broadcom:arcturus_admin`

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | VCF Automation role ID (URN) |

## Lifecycle

```
CR created
    │
    ▼
Busy - creating role in the target organisation in VCF Automation
    │
    ▼
Healthy - role created, externalId populated
    │
    ├─ rights updated
    │       │
    │       ▼
    │   Busy - updating role rights
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

- If the specified `organization` does not exist in VCF Automation, the CR transitions to `Unhealthy`.
- A role cannot be deleted while a `VcfaServiceAccount` or other entity holds a reference to it; the controller will retry until the dependency is removed.

## Example

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: Role
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-agent
spec:
  name: Arcturus Service Agent
  description: >-
    Service account role for Arcturus to interact with VCF Automation API.
    Provides necessary permissions for service discovery and configuration.
  rights:
    - RIGHT_AUTOMATION_PROJECT_VIEW
    - RIGHT_NAMESPACE_LIFECYCLE_VIEW
    - RIGHT_USER_VIEW
    - RIGHT_ORGANIZATION_VIEW
    - RIGHT_ORG_TRAVERSE
    - RIGHT_SERVICE_ACCOUNT_VIEW
    - RIGHT_TASK_VIEW
    - RIGHT_SYSTEM_SETTINGS_VIEW
  organization: System
```
