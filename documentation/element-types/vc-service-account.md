# VcServiceAccount

A `VcServiceAccount` creates a user account in vCenter that grants a Supervisor service the permissions it needs to interact with the vCenter API. The controller creates the account with the specified role, group memberships, and optional password, scoped to a specific vCenter and region.

## When to Use

- Provision a vCenter identity for a Supervisor-hosted service that must perform VM lifecycle operations, manage storage, or configure networking.
- Create a scoped vCenter account for each region or vCenter in a multi-site deployment.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `username` | string | Yes | vCenter username (without domain suffix) |
| `roleName` | string | Yes | vCenter role name to assign to the account |
| `groups` | []string | Yes | vCenter groups to add the account to |
| `passwordExpires` | boolean | No | Whether the password expires; defaults to `false` |
| `region` | string | No | VCF region name; used to resolve the target vCenter |
| `vcenter` | string | No | vCenter identifier (FQDN or ID); overrides region-based discovery |
| `password` | PathSelector | No | Resolves the password from a Kubernetes Secret; if omitted a password is generated |

### Password Selector

When `password` is specified the controller reads the password value from the identified Secret field:

```yaml
password:
  kind: Secret
  labels:
    service-account: arcturus-vcenter-account
  path: data.password
```

If `password` is omitted, the controller generates a random password and stores it in the same Secret referenced by the selector (or in a controller-managed Secret if no selector is provided).

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | vCenter service account ID |

## Lifecycle

```
CR created
    │
    ▼
Busy - resolving password from selector (if configured)
    │  ↺ retries every 10 s until Secret exists
    ▼
Busy - creating user account in vCenter
    │  Assigning role and group memberships
    ▼
Healthy - account active, externalId populated
    │
    ├─ roleName or groups updated
    │       │
    │       ▼
    │   Busy - updating account in vCenter
    │       │
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - removing account from vCenter
            │
            ▼
        CR removed
```

- If the vCenter is unreachable during reconciliation, the CR remains `Busy` and retries with backoff.
- The `username` field is used as the account identifier in vCenter; changing it requires deleting and recreating the CR.

## Example

```yaml
---
apiVersion: v1
kind: Secret
metadata:
  generateName: arcturus-vc-sa-
  labels:
    service-account: arcturus-vcenter-account
stringData:
  password: "GeneratedPassword123!"
type: Opaque
---
apiVersion: services.vcfa.broadcom.com/v2
kind: VcServiceAccount
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-vc-sa
spec:
  region: us-west-1
  vcenter: vcenter1.example.com
  username: svc-arcturus
  roleName: Arcturus Service Role
  groups:
    - AutoUpdate
    - ServiceAccounts
  passwordExpires: false
  password:
    kind: Secret
    labels:
      service-account: arcturus-vcenter-account
    path: data.password
```
