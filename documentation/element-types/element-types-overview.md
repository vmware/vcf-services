# Element Types Overview

VCF Service Manager manages the lifecycle of a VCF Service by reconciling a set of Custom Resources (CRs). Each CR type maps to a distinct capability in the VCF Automation platform - from deploying packages on Supervisor clusters to registering UI plugins and creating service accounts.

This section documents every CR available in API version `services.vcfa.broadcom.com/v2`, covering its purpose, spec fields, status fields, and lifecycle from a service author's perspective.

> **Note:**
> Build, package, sign, verify, install, upgrade, delete, and troubleshooting of VCF Services as a whole are covered in separate guides. This section focuses exclusively on the individual CR types and their runtime behaviour.

## API Group

All CRs belong to the same API group and version:

```text
apiVersion: services.vcfa.broadcom.com/v2
```

## Custom Resource Types

| CR | Purpose |
| :---- | :---- |
| [SupervisorService](supervisor-service.md) | Deploy a Carvel package as a Supervisor Service on a vSphere Supervisor cluster |
| [SupervisorRegistry](supervisor-registry.md) | Configure a container image registry on a Supervisor cluster |
| [Overlay](overlay.md) | Dynamically inject runtime values into other CRs using ytt templates |
| [GlobalRole](global-role.md) | Create a role with custom rights distributed across all tenant organisations |
| [Role](role.md) | Create a role scoped to a single organisation |
| [RightBundle](right-bundle.md) | Group custom rights that org admins can use to compose roles |
| [VcfaServiceAccount](vcfa-service-account.md) | Create an OAuth service account for programmatic access to VCF Automation |
| [VcServiceAccount](vc-service-account.md) | Create a service account in vCenter for Supervisor services |
| [ApiExtension](api-extension.md) | Register a custom API endpoint backed by an MQTT service |
| [ApiExtensionProxy](api-extension-proxy.md) | Configure VCF Automation as a transparent HTTP proxy to a backend REST API |
| [RelyingParty](relying-party.md) | Register an OAuth relying party for SSO and service authentication |
| [UserInterfacePlugin](user-interface-plugin.md) | Register a UI plugin that extends the VCF Automation web interface |
| [RdeBundle](rde-bundle.md) | Deploy Runtime Defined Entity types, interfaces, and behaviors |

## CR Identification

Element type CRs do not use `metadata.name` or `metadata.generateName` for identification. Instead, the `services.vcfa.broadcom.com/name` label on `metadata.labels` is the primary identifier. The Service Manager assigns system-generated names at creation time; the `services.vcfa.broadcom.com/name` label is what other CRs (such as `KindSelector` references) use to locate a specific resource.

```yaml
# Correct: identify by label
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-registry

# Also correct: additional labels alongside name
metadata:
  labels:
    services.vcfa.broadcom.com/name: arcturus-install
    services.vcfa.broadcom.com/overlay: install.us-west-1
    services.vcfa.broadcom.com/overlay-apply: eager
```

Native Kubernetes resources (such as `Secret` and `ConfigMap`) created alongside a VCF Service bundle may still use `generateName`.

## Common Status Structure

Every CR exposes a standard status block:

| Field | Type | Description |
| :---- | :---- | :---- |
| `status` | string | Resource health: `Healthy`, `Busy`, `Unhealthy`, `Maintenance` |
| `message` | string | Human-readable description of the current state |
| `conditions` | array | Detailed Kubernetes conditions |
| `observedGeneration` | integer | Last spec generation that was successfully reconciled |
| `lastGenerationChange` | timestamp | When `observedGeneration` was last updated |

### Status Values

| Value | Meaning |
| :---- | :---- |
| `Healthy` | All operations succeeded; the resource is operating normally |
| `Busy` | A reconciliation operation is in progress |
| `Unhealthy` | An error occurred; see `message` and `conditions` for details |
| `Maintenance` | Reconciliation is temporarily suspended (e.g. upgrade in progress) |

## Common Selector Types

Many CRs use selectors to resolve values from other Kubernetes resources at reconciliation time.

### PathSelector

Selects a specific value from a resource field identified by a JSONPath expression:

```yaml
selector:
  kind: Secret
  labels:
    services.vcfa.broadcom.com/context: install
  path: data.password
```

### KindSelector

Selects a resource by kind and labels, without extracting a specific field:

```yaml
selector:
  kind: Secret
  labels:
    services.vcfa.broadcom.com/name: arcturus-config
```

## Resource Scope

CRs that can be published to tenants use `ResourceScope`:

```yaml
scope:
  allTenants: true      # publish to all tenant organisations
```

## Well-Known Labels

CRs may carry well-known labels that control routing, overlay behaviour, and cross-resource references:

| Label | Purpose |
| :---- | :---- |
| `services.vcfa.broadcom.com/name` | Primary logical identifier; used by `KindSelector` references and cross-resource lookups |
| `services.vcfa.broadcom.com/context` | Semantic tag (e.g. `install`, `supervisor-service`) |
| `services.vcfa.broadcom.com/overlay` | Names the Overlay that should be applied to this CR |
| `services.vcfa.broadcom.com/overlay-apply` | Overlay application strategy: `eager` or `lazy` |
| `services.vcfa.broadcom.com/link-region` | Links a resource to a specific region |
