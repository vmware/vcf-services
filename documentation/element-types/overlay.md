# Overlay

An `Overlay` collects runtime values - from literal constants or from other Kubernetes resources - and applies a [ytt](https://carvel.dev/ytt/) transformation to the spec of a target CR. This enables dynamic configuration injection without hardcoding values that are only known after other resources have been deployed (for example, injecting the external IP address of a deployed service into another service's configuration values).

## When to Use

- Inject a dynamically assigned IP or hostname from a deployed Supervisor service into another CR's spec.
- Update registry credentials in an `SupervisorRegistry` after a Arcturus instance is ready.
- Configure cross-region dependencies between CRs that are resolved at runtime.
- Insert TLS certificates from a Supervisor Secret into an endpoint configuration.

## How Overlays Work

The controller resolves all values defined in `spec.data`, writes them plus the ytt template into a Kubernetes Secret, and marks the target CR (identified by the `services.vcfa.broadcom.com/overlay` label) to use that Secret during its next reconciliation. The target CR applies the ytt transformation at runtime before executing its own operations.

```
Overlay CR
  spec.data     ─── resolve values ──► Overlay Secret
  spec.overlay                         (data.values + data.overlay)
                                            │
                                            ▼
                                    Target CR reconciles
                                    with transformed spec
```

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `data` | OverlayData | Yes | Map of named values to collect; each entry is either a literal string or a selector |
| `overlay` | string | Yes | ytt overlay template that references the collected values via `data.values.<key>` |

### OverlayData

`data` is a map where each key becomes a variable in the ytt template under `data.values`:

```yaml
data:
  # Literal value
  registry_port:
    value: "5000"

  # Value resolved from another resource at reconciliation time
  depot_ip:
    selector:
      kind: SupervisorService
      labels:
        services.vcfa.broadcom.com/context: install
        services.vcfa.broadcom.com/link-region: us-west-1
      path: status.readyConditions.externalIp

  tls_cert:
    selector:
      kind: Secret
      labels:
        app: arcturus
      path: data.tls\.crt
```

Each entry is an `OverlayDataItem` with exactly one of:

| Field | Description |
| :---- | :---- |
| `value` | Literal string value used as-is |
| `selector` | [PathSelector](element-types-overview.md#pathselector) - resolves the value from a Kubernetes resource field at runtime |

### Overlay Template

A ytt overlay that patches the target CR's spec. The collected values are available as `data.values.<key>`:

```yaml
overlay: |
  #@ load("@ytt:overlay", "overlay")

  #@overlay/match by=overlay.subset({"values": {}})
  ---
  values:
    selector:
      #@overlay/match-child-defaults missing_ok=True
      kind: Secret
      name: dynamic-config
      path: data.values
    #@overlay/replace
    patch: |
      external_ip: #@ data.values.depot_ip
      registry:
        port: #@ int(data.values.registry_port)
        host: #@ data.values.depot_ip
```

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | External identifier (populated when applicable) |

## Linking an Overlay to a Target CR

Add two labels to the CR that should receive the overlay transformation:

```yaml
labels:
  services.vcfa.broadcom.com/overlay: <overlay-name>
  services.vcfa.broadcom.com/overlay-apply: eager   # or lazy
```

The `overlay` label value must match the Overlay CR's own `services.vcfa.broadcom.com/overlay` label. The `overlay-apply` label controls when the transformation runs:

| Strategy | Behaviour |
| :---- | :---- |
| `eager` | The target CR waits until the Overlay is `Healthy` before reconciling |
| `lazy` | The target CR reconciles immediately with whatever values are available |

## Lifecycle

```
Overlay CR created
    │
    ▼
Busy - resolving data values
    │  • Literal values: used immediately
    │  • Selector values: queried from cluster
    │  ↺ If any selector fails → remain Busy, retry every 10 s
    ▼
Healthy - all values resolved
    │  Controller creates/updates Overlay Secret
    │  (contains: data.values JSON + data.overlay ytt template)
    │
    ▼
Target CR detects Overlay Secret
    │  Applies ytt transformation to runtime spec
    │  Proceeds with normal reconciliation
    │
    ├─ Source resource changes (e.g. IP changes)
    │       │
    │       ▼
    │   Busy - re-resolving values
    │       │  ↺ every 10 min (Healthy) or 10 s (Busy)
    │       ▼
    │   Healthy - Overlay Secret updated, target re-reconciled
    │
    └─ Overlay CR deleted
            │
            ▼
        Overlay Secret deleted
            │
            ▼
        CR removed
```

## Examples

### External IP Injection

This example shows how to inject a dynamically assigned external IP from one SupervisorService into another SupervisorService's configuration values:

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: Overlay
metadata:
  labels:
    services.vcfa.broadcom.com/name: external-ip-overlay
    services.vcfa.broadcom.com/overlay: publish.us-west-1
spec:
  data:
    backend_ip:
      selector:
        kind: SupervisorService
        labels:
          services.vcfa.broadcom.com/name: backend-service
          services.vcfa.broadcom.com/link-region: us-west-1
        path: status.readyConditions.externalIp
    backend_port:
      value: "8080"
  overlay: |
    #@ load("@ytt:overlay", "overlay")

    #@overlay/match by=overlay.subset({"values": {}})
    ---
    values:
      selector:
        kind: Secret
        #@overlay/match-child-defaults missing_ok=True
        name: frontend-config
        path: data.values
      #@overlay/replace
      patch: |
        backend:
          host: #@ data.values.backend_ip
          port: #@ int(data.values.backend_port)
          url: #@ "http://{}:{}".format(data.values.backend_ip, data.values.backend_port)
```

### Certificate Injection

This example demonstrates injecting TLS certificates from a Supervisor Secret into a SupervisorService's configuration:

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: Overlay
metadata:
  labels:
    services.vcfa.broadcom.com/name: tls-cert-overlay
    services.vcfa.broadcom.com/overlay: secure.us-west-1
spec:
  data:
    tls_cert:
      selector:
        kind: SupervisorService
        labels:
          services.vcfa.broadcom.com/name: cert-manager
          services.vcfa.broadcom.com/link-region: us-west-1
        path: status.readyConditions.certificates
    ca_bundle:
      selector:
        kind: Secret
        labels:
          services.vcfa.broadcom.com/context: ca-certs
          services.vcfa.broadcom.com/link-region: us-west-1
        path: data.ca-bundle\.crt
  overlay: |
    #@ load("@ytt:overlay", "overlay")

    #@overlay/match by=overlay.subset({"values": {}})
    ---
    values:
      selector:
        kind: Secret
        #@overlay/match-child-defaults missing_ok=True
        name: tls-config
        path: data.values
      #@overlay/replace
      patch: |
        tls:
          enabled: true
          certificate: #@ data.values.tls_cert
          ca_bundle: #@ data.values.ca_bundle
        security:
          verify_ssl: true
```
