# ApiExtensionProxy

An `ApiExtensionProxy` configures VCF Automation as a transparent HTTP reverse proxy to a backend REST API. Unlike [ApiExtension](api-extension.md), no MQTT integration is required - VCF Automation simply forwards matching HTTP requests to the `rootUrl` and returns the backend's response to the caller. This is the preferred integration pattern for services that expose their own HTTP API or UI within the management network.

## When to Use

- Proxy HTTP requests to a service UI or REST API that is not directly reachable by end users (e.g. a Arcturus web UI running inside a Supervisor namespace).
- Integrate an iFrame-based [UserInterfacePlugin](user-interface-plugin.md) with a backend API that requires authentication context from VCF Automation.
- Provide a single, authenticated entry point for third-party products whose APIs live inside the management network.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `name` | string | Yes | Proxy name; must be unique within the vendor/version namespace |
| `vendor` | string | Yes | Vendor identifier |
| `version` | string | Yes | Version string (e.g. `1.0.0`) |
| `rootUrl` | string | Yes | Backend service base URL; all matched requests are forwarded here |
| `enabled` | boolean | No | Enables or disables the proxy; defaults to `true` |
| `urlMatchers` | []UrlMatcher | No | URL patterns to register; if empty, no requests are proxied |

### UrlMatcher

```yaml
urlMatchers:
  - urlPattern: /arcturus/.*
    urlScope: EXT_UI_PROVIDER
  - urlPattern: /arcturus/api/.*
    urlScope: EXT_UI_PROVIDER
```

| Field | Description |
| :---- | :---- |
| `urlPattern` | Regular expression path pattern; must end with `.*` |
| `urlScope` | `EXT_UI_PROVIDER` - provider portal; `EXT_UI_TENANT` - tenant portal; `EXT_API` - API layer |

A request to `https://<vcfa-host>/proxy/external-endpoint/ui/provider/arcturus/projects` is forwarded to `<rootUrl>/projects`.

### Enabled vs Disabled

When `enabled` is `false`, VCF Automation treats the proxy as if it does not exist and returns an error for all matching requests. The proxy must be disabled before it can be deleted.

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | VCF Automation external endpoint ID (URN) |

## Lifecycle

```
CR created
    │
    ▼
Busy - registering external endpoint in VCF Automation
    │  Registering URL matchers
    ▼
Healthy - proxy active, externalId populated
    │
    ├─ rootUrl, urlMatchers, or enabled updated
    │       │
    │       ▼
    │   Busy - updating proxy registration
    │       │
    │       ▼
    │   Healthy
    │
    └─ CR deleted
            │
            ▼
        Busy - disabling and de-registering proxy
            │
            ▼
        CR removed
```

- The `rootUrl` must be reachable from the VCF Automation appliance. The server certificate of the backend must be trusted by VCF Automation; see the VCF Automation certificate management documentation.
- Disabling the proxy (`enabled: false`) does not remove the registration; it only suspends request forwarding.

## Example

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: ApiExtensionProxy
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-ui-proxy
spec:
  name: ArcturusUIProxy
  vendor: Corp
  version: 1.0.0
  enabled: true
  rootUrl: https://arcturus.svc.cluster.local:443
  urlMatchers:
    - urlPattern: /arcturus/.*
      urlScope: EXT_UI_PROVIDER
    - urlPattern: /arcturus/api/.*
      urlScope: EXT_UI_PROVIDER
```
