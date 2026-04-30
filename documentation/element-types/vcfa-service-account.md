# VcfaServiceAccount

A `VcfaServiceAccount` creates an OAuth service account in VCF Automation for programmatic API access. The controller registers the client application, assigns a [Role](role.md), and stores the generated credentials (`clientId`, `clientSecret`, and an initial access token) in the Kubernetes Secret identified by the `selector`.

## When to Use

- Provide a service backend with the credentials needed to call the VCF Automation API.
- Create an identity for CI/CD pipelines or automation scripts that interact with VCF Automation.
- Enable service-to-service OAuth flows where one VCF Service component authenticates to another.

**⚠️ Important**
> `VcfaServiceAccount` spec is **immutable** after creation. If you need to change any spec field, delete the CR and create a new one. The controller enforces immutability via a validation webhook.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `clientName` | string | Yes | OAuth client name; must be unique within VCF Automation |
| `roleName` | string | Yes | Name of an existing VCF Automation role to assign to the account |
| `selector` | KindSelector | Yes | Identifies the Kubernetes Secret where credentials will be written |
| `name` | string | No | Display name for the service account |
| `uri` | string | No | Service URI (used for OAuth client metadata) |
| `softwareId` | string | No | Software identifier UUID (used for OAuth client metadata) |
| `softwareVersion` | string | No | Software version string (used for OAuth client metadata) |

### Credentials Secret

After successful creation the controller writes the following keys into the selected Secret:

```yaml
data:
  clientId:     <base64-encoded OAuth client ID>
  clientSecret: <base64-encoded OAuth client secret>
  accessToken:  <base64-encoded initial access token>
```

The Secret must already exist before the CR is created, or the controller will remain `Busy` until it appears.

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | VCF Automation service account ID (URN) |

## Lifecycle

```
CR created (spec is locked immediately - immutable)
    │
    ▼
Busy - locating target Secret via selector
    │  ↺ retries every 10 s until Secret exists
    ▼
Busy - registering OAuth client in VCF Automation
    │  Assigning role: spec.roleName
    ▼
Busy - writing credentials into target Secret
    │  (clientId, clientSecret, accessToken)
    ▼
Healthy - account active, externalId populated
    │
    └─ CR deleted
            │
            ▼
        Busy - de-registering OAuth client from VCF Automation
            │  Revoking credentials
            ▼
        Credentials removed from Secret
            │
            ▼
        CR removed
```

- Because the spec is immutable, spec changes are rejected by the Kubernetes API server with a validation error.
- Credentials are not rotated automatically. To rotate, delete and recreate the CR.
- If the `roleName` references a [Role](role.md) that does not yet exist in VCF Automation, the CR remains `Busy` until the role becomes available.

## Example

```yaml
---
apiVersion: v1
kind: Secret
metadata:
  generateName: arcturus-sa-
  labels:
    service-account: arcturus-service-account
stringData:
  placeholder: ""   # controller will overwrite with real credentials
type: Opaque
---
apiVersion: services.vcfa.broadcom.com/v2
kind: VcfaServiceAccount
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-sa
spec:
  name: Arcturus Service Account
  clientName: arcturus-service-account
  roleName: Arcturus Service Agent
  softwareId: 40e7cc12-bb1b-4157-9890-a6a7740a9dd0
  softwareVersion: "2.11.1"
  uri: "https://arcturus.example.com"
  selector:
    kind: Secret
    labels:
      service-account: arcturus-service-account
```
