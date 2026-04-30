# UserInterfacePlugin

A `UserInterfacePlugin` registers a UI plugin with VCF Automation, extending the web interface with service-specific views and navigation items. The controller downloads the plugin ZIP from an OCI repository, uploads it to VCF Automation, and optionally scopes it to specific tenant organisations.

More details on building a UI plugin, including manifest format, extension points, and the Angular SDK, are available in [UI Extensibility](../extensibility-platform/ui-extensibility.md).

## When to Use

- Add a service management interface (e.g. a Arcturus project browser) to the VCF Automation provider or tenant portals.
- Deliver a custom dashboard or resource management UI as part of a VCF Service.
- Control which tenants can see and use the plugin without deploying separate instances.

## Spec Fields

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `image` | string | Yes | OCI image reference for the plugin ZIP artifact (e.g. `registry.example.com/plugins/arcturus-ui:2.11.1`) |
| `enabled` | boolean | No | Enable or disable the plugin; defaults to `true` |
| `scope` | ResourceScope | No | Controls which tenant organisations see the plugin |
| `allowMultipleVersions` | boolean | No | When `true`, multiple versions of the plugin can coexist; defaults to `false` |

### ResourceScope

```yaml
scope:
  allTenants: true
```

When `allTenants` is `true` the plugin is visible to all tenant organisations. When `false`, only the organisations listed in `tenants` can access it.

## Status Fields

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable status message |
| `externalId` | string | VCF Automation plugin ID (URN) |
| `source` | string | Resolved OCI source URL from which the plugin was downloaded |
| `sha` | string | SHA digest of the plugin artifact |
| `unavailableSince` | timestamp | Set when the plugin image becomes unavailable in the registry |

## Lifecycle

```
CR created
    │
    ▼
Busy - pulling plugin ZIP from OCI repository (spec.image)
    │  ↺ retries with backoff if image is unavailable
    ▼
Busy - uploading plugin to VCF Automation
    │  Validating plugin manifest and binary compatibility
    ▼
Busy - applying scope (publishing to tenants)
    │
    ▼
Healthy - plugin active, externalId and sha populated
    │
    ├─ image tag updated (new version)
    │       │
    │       ▼
    │   Busy - pulling new image, replacing plugin
    │       │  (or adding alongside if allowMultipleVersions: true)
    │       ▼
    │   Healthy
    │
    ├─ scope updated
    │       │
    │       ▼
    │   Busy - updating tenant visibility
    │       │
    │       ▼
    │   Healthy
    │
    ├─ enabled set to false
    │       │
    │       ▼
    │   Healthy - plugin disabled (hidden from portal)
    │
    └─ CR deleted
            │
            ▼
        Busy - removing plugin from VCF Automation
            │
            ▼
        CR removed
```

- If the OCI image becomes unreachable after a successful install, `status.unavailableSince` is set and the plugin continues to function with the last successfully uploaded artifact.
- Setting `enabled: false` hides the plugin from the portal but does not remove it; re-enabling restores visibility without re-uploading.
- Binary compatibility is validated at upload time; an incompatible plugin (wrong Angular version, missing manifest fields) causes an `Unhealthy` state.

## Example

```yaml
apiVersion: services.vcfa.broadcom.com/v2
kind: UserInterfacePlugin
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-ui
spec:
  image: arcturus.example.com/vcf-plugins/arcturus-ui-plugin.zip:2.11.1
  enabled: true
  allowMultipleVersions: false
  scope:
    allTenants: true
```
