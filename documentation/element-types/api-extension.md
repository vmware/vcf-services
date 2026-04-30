# ApiExtension

An `ApiExtension` registers a custom API endpoint with VCF Automation that is backed by an MQTT service. Requests to the registered URL patterns are forwarded over the VCF Automation MQTT message bus to the service backend, which processes them and replies. This enables services to expose their own REST-style APIs through the VCF Automation API layer without running an HTTP server accessible from outside the management network.

## When to Use

- Expose service-specific API endpoints (e.g. `/api/arcturus/projects`) through the VCF Automation API.
- Integrate a service backend that communicates over MQTT.
- Provide both provider-scoped and tenant-scoped API paths for a service.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `name` | string | Yes | API extension name; must be unique within the vendor/version namespace |
| `vendor` | string | Yes | Vendor identifier |
| `version` | string | Yes | Version string (e.g. `1.0.0`) |
| `tokenConfig` | ApiExtensionTokenConfig | Yes | Selects the Secret containing the MQTT authentication token |
| `urlMatchers` | []UrlMatcher | Yes | URL patterns to register; requests matching these are routed to the MQTT backend |

### ApiExtensionTokenConfig

```yaml
tokenConfig:
  selector:
    kind: Secret
    labels:
      api-extension: arcturus-api
```

The selected Secret must contain the MQTT extension token used to authenticate the service backend to the MQTT broker.

### UrlMatcher

```yaml
urlMatchers:
  - urlPattern: /api/arcturus/projects.*
    urlScope: EXT_UI_PROVIDER
  - urlPattern: /api/arcturus/artifacts.*
    urlScope: EXT_UI_TENANT
```

| Field | Description |
| :---- | :---- |
| `urlPattern` | Regular expression path pattern; must end with `.*` |
| `urlScope` | `EXT_UI_PROVIDER` - accessible to provider users; `EXT_UI_TENANT` - accessible to tenant users |

Registered URLs are reachable at:
- Provider: `https://<vcfa-host>/proxy/external-endpoint/ui/provider/<urlPattern>`
- Tenant: `https://<vcfa-host>/proxy/external-endpoint/ui/tenant/<urlPattern>`

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | VCF Automation API extension ID (URN) |
| `extensionEndpoints` | []string | Registered endpoint URL patterns |

## Lifecycle

```
CR created
    │
    ▼
Busy - resolving token Secret via tokenConfig.selector
    │  ↺ retries every 10 s until Secret exists
    ▼
Busy - registering extension service in VCF Automation
    │  Registering URL matchers
    ▼
Healthy - extension active, externalId populated,
          extensionEndpoints reflect registered paths
    │
    ├─ urlMatchers updated
    │       │
    │       ▼
    │   Busy - updating URL registrations
    │       │
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - de-registering extension from VCF Automation
            │
            ▼
        CR removed
```

- If the MQTT token is missing or invalid, VCF Automation will reject incoming MQTT messages from the backend; the CR itself may still be `Healthy` from a registration perspective.
- Multiple `ApiExtension` CRs can coexist as long as their `name`/`vendor`/`version` combinations are unique.

## Example

```yaml
---
apiVersion: v1
kind: Secret
metadata:
  generateName: arcturus-api-token-
  labels:
    api-extension: arcturus-api
stringData:
  token: "mqtt-topic-token-12345"
  user: "arcturus-api-user"
type: Opaque
---
apiVersion: services.vcfa.broadcom.com/v2
kind: ApiExtension
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-api
spec:
  name: arcturus-api
  vendor: broadcom
  version: 1.0.0
  tokenConfig:
    selector:
      kind: Secret
      labels:
        api-extension: arcturus-api
  urlMatchers:
    - urlPattern: /api/arcturus/projects.*
      urlScope: EXT_UI_PROVIDER
    - urlPattern: /api/arcturus/repositories.*
      urlScope: EXT_UI_PROVIDER
    - urlPattern: /api/arcturus/artifacts.*
      urlScope: EXT_UI_TENANT
```
