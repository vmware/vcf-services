# RelyingParty

A `RelyingParty` registers an OAuth 2.0 relying party (client application) in the VCF Automation identity provider. This enables the service to participate in single sign-on (SSO) flows - users authenticated in VCF Automation can be seamlessly logged into the service using standard OAuth 2.0 authorization code flow.

## When to Use

- Enable SSO between VCF Automation and a service UI (e.g. a Arcturus web interface).
- Register an OAuth client for a service-to-service authentication flow.
- Configure redirect URIs for callback handling after OAuth authorization.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `name` | string | Yes | Relying party name; used as the OAuth client display name |
| `isPublic` | boolean | Yes | `true` for public clients (no client secret, e.g. SPAs); `false` for confidential clients |
| `redirectUris` | []string | Yes | Allowed OAuth redirect URIs; authorization codes are only sent to these URIs |
| `selector` | KindSelector | Yes | Identifies the Kubernetes Secret where OAuth credentials will be written |

### Public vs Confidential Clients

| | `isPublic: true` | `isPublic: false` |
| :---- | :---- | :---- |
| Client secret issued | No | Yes |
| Typical use | Browser-side SPA | Server-side web app or service |
| PKCE required | Recommended | Optional |

### Credentials Secret

After successful registration the controller writes the OAuth credentials into the selected Secret:

```yaml
data:
  clientId:     <base64-encoded OAuth client ID>
  clientSecret: <base64-encoded OAuth client secret>  # only for confidential clients
```

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | VCF Automation relying party ID (URN) |

## Lifecycle

```
CR created
    │
    ▼
Busy - locating target Secret via selector
    │  ↺ retries every 10 s until Secret exists
    ▼
Busy - registering OAuth client in VCF Automation identity provider
    │
    ▼
Busy - writing clientId (and clientSecret if confidential) into Secret
    │
    ▼
Healthy - relying party active, externalId populated
    │
    ├─ redirectUris updated
    │       │
    │       ▼
    │   Busy - updating redirect URI list
    │       │
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - de-registering OAuth client
            │
            ▼
        CR removed
```

- `isPublic` cannot be changed after creation without deleting and recreating the CR.
- Credentials stored in the Secret are not rotated automatically; delete and recreate the CR to obtain new credentials.

## Example

```yaml
---
apiVersion: v1
kind: Secret
metadata:
  generateName: arcturus-oauth-
  labels:
    relying-party: arcturus-oauth
stringData:
  placeholder: ""   # controller will write real credentials here
type: Opaque
---
apiVersion: services.vcfa.broadcom.com/v2
kind: RelyingParty
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-oauth
spec:
  name: arcturus-relying-party
  isPublic: false
  redirectUris:
    - https://arcturus.example.com/c/oidc/callback
    - https://vcfa.example.com/arcturus/callback
  selector:
    kind: Secret
    labels:
      relying-party: arcturus-oauth
```
