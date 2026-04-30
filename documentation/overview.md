# VCF Services Development Guide

VMware Cloud Foundation (VCF) Services is the packaging and lifecycle management framework for deploying software services across the VCF Automation fleet. A VCF Service bundles all configuration, OCI artifacts, and platform integration declarations needed to install, operate, and upgrade a service across one or more vSphere Supervisor clusters - in multiple regions and for multiple tenant organisations - from a single control plane inside VCF Automation.

---

## Where VCF Services Fit

VCF Automation sits at the top of the VMware Cloud Foundation stack. It provisions and orchestrates the fleet of vSphere Supervisor clusters that run below it. A VCF Service lives at this level:

```text
┌──────────────────────────────────────────────────────────────────┐
│                     VMware Cloud Foundation                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   VCF Automation (VCF-A)                    │ │
│  │                                                             │ │
│  │   Service Manager                                           │ │
│  │   ┌─────────────────────────────────────────────────────┐   │ │
│  │   │  VCF Service                                        │   │ │
│  │   │  - RBAC, UI plugin, API endpoints, RDEs, OAuth      │   │ │
│  │   │  - Deployed across all target Supervisors           │   │ │
│  │   └─────────────────────────────────────────────────────┘   │ │
│  └──────────────────────┬──────────────────────────────────────┘ │
│                         │ manages fleet                          │
│         ┌───────────────┼───────────────┐                        │
│         ▼               ▼               ▼                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                 │
│  │ Supervisor  │ │ Supervisor  │ │ Supervisor  │                 │
│  │ us-west-1   │ │ us-east-1   │ │ eu-west-1   │                 │
│  └─────────────┘ └─────────────┘ └─────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
```

When a VCF Service is activated, Service Manager:

1. Generates installation values by combining the platform inventory (regions, Supervisor clusters, storage classes, tenants) with the service's transpiler and any operator overrides.
2. Reconciles every Kubernetes Custom Resource (CR) declared in the service bundle - deploying Carvel packages to Supervisor clusters, registering UI plugins, creating service accounts, configuring API endpoints, and more.
3. Continuously monitors the health of each CR across the entire fleet and surfaces the aggregate status through the VCF Automation UI and REST API.

A VCF Service is therefore not just a Kubernetes package: it is a complete extensibility contract with VCF Automation that covers fleet-scale deployment, multi-tenancy, RBAC, UI integration, and lifecycle management.

---

## VCF Services and Supervisor Services

VCF Services and Supervisor Services serve related but distinct purposes.

| | VCF Services | Supervisor Services |
| :---- | :---- | :---- |
| **Scope** | Fleet - multiple Supervisor clusters across multiple regions and tenants | Single Supervisor cluster |
| **Control plane** | VCF Automation Service Manager | vSphere / Supervisor control plane directly |
| **Packaging format** | Carvel package with `services.vcfa.broadcom.com/v2` CRs | Carvel package deployed via `SupervisorService` CR |
| **Platform integration** | Full (RBAC, UI, API, OAuth, RDE, multi-tenancy) | Kubernetes workloads on the Supervisor cluster only |
| **Lifecycle management** | Install, upgrade, rollback, delete managed by Service Manager | Managed by vSphere or external tooling |

**If your goal is to deploy a workload on a single Supervisor cluster** and you do not need multi-Supervisor cluster orchestration or VCF Automation platform integration, start with the [Supervisor Services Development Guide](../supervisor-services/overview.md) (vSphere Supervisor Services documentation).

**If your Supervisor Service needs to participate in VCF Automation** - to be discoverable and lifecycle-managed across a fleet, to integrate with VCF Automation RBAC, UI, or API, or to be offered to tenants - follow this guide. The `SupervisorService` CR is one of the element types a VCF Service can declare; packaging it inside a VCF Service is what brings it under VCF Automation management.

---

## How This Guide Is Organised

The documentation is structured in three sections, each building on the one below it.

### Section 1 - Extensibility Platform

The VCF Automation platform provides a set of low-level extensibility primitives that any VCF Service can use independently of the VCF Services framework:

| Capability | Description |
| :---- | :---- |
| [UI Extensibility](extensibility-platform/ui-extensibility.md) | Angular plugins and iFrame integrations that extend the VCF Automation web UI |
| [API Extensibility](extensibility-platform/api-extensibility.md) | Custom REST API endpoints backed by MQTT services or HTTP proxy pass-through |
| [Runtime Defined Entities](extensibility-platform/defined-entities/defined-entities-overview.md) | Custom object types persisted in the VCF Automation database, with Webhook and MQTT behaviors |
| [Message Broker](extensibility-platform/message-broker.md) | MQTT message bus for event-driven extension backends |
| [Custom Rights](extensibility-platform/custom-rights.md) | Fine-grained access control integrated with VCF Automation RBAC |
| [Object Metadata](extensibility-platform/object-metadata-2.md) | User-defined properties on core VCF Automation objects |

Understanding these primitives is important, because VCF Service authors can use them by declaring them through [element types](element-types/element-types-overview.md) (Section 2).

### Section 2 - Element Types

Element types are the Kubernetes Custom Resources (`services.vcfa.broadcom.com/v2`) that a VCF Service bundle declares. Each CR type enables a specific VCF extensibility capability or operation:

| Category | Element types |
| :---- | :---- |
| **Supervisor** | [`SupervisorService`](element-types/supervisor-service.md), [`SupervisorRegistry`](element-types/supervisor-registry.md) |
| **Configuration** | [`Overlay`](element-types/overlay.md) |
| **RBAC** | [`GlobalRole`](element-types/global-role.md), [`Role`](element-types/role.md), [`RightBundle`](element-types/right-bundle.md) |
| **Identity** | [`VcfaServiceAccount`](element-types/vcfa-service-account.md), [`VcServiceAccount`](element-types/vc-service-account.md), [`RelyingParty`](element-types/relying-party.md) |
| **API** | [`ApiExtension`](element-types/api-extension.md), [`ApiExtensionProxy`](element-types/api-extension-proxy.md) |
| **UI** | [`UserInterfacePlugin`](element-types/user-interface-plugin.md) |
| **Data** | [`RdeBundle`](element-types/rde-bundle.md) |

Service Manager reconciles each CR against its target system (VCF Automation, vCenter, or Supervisor cluster) and reports status through a [common status structure](element-types/element-types-overview.md#common-status-structure).

### Section 3 - Lifecycle

The lifecycle section describes how to create, distribute, and operate a VCF Service end-to-end:

| Document | Description |
| :---- | :---- |
| [VCF Service Lifecycle Overview](lifecycle/vcf-service-overview.md) | Service lifecycle states and architecture |
| [Filesystem Layout](lifecycle/filesystem-layout.md) | VCF Service bundle directory structure |
| [Packaging and Distribution](lifecycle/packaging-and-build.md) | Build workflow and Carvel toolchain |
| [Runtime Spec and Overlay](lifecycle/runtime-spec.md) | Dynamic configuration injection using the Overlay CR and ytt |
| [Upgrade and Deletion](lifecycle/upgrade.md) | Post-installation lifecycle: upgrade, rollback, and deletion |
| [Service API Reference](lifecycle/api.md) | REST API for managing VCF Services programmatically |

---

## Getting Started

### I am building a new VCF Service from scratch

1. Read the [VCF Service Lifecycle Overview](lifecycle/vcf-service-overview.md) to understand service states, distribution, and how values are generated.
2. Follow the [Filesystem Layout](lifecycle/filesystem-layout.md) guide to set up your bundle directory.
3. Choose which [Element Types](element-types/element-types-overview.md) your service needs and author the corresponding CRs.
4. Build and package using the [Packaging and Distribution](lifecycle/packaging-and-build.md) guide.
5. Use the [Service API Reference](lifecycle/api.md) to install and manage the service lifecycle via REST.

### I have an existing Supervisor Service and want to bring it into VCF Automation

1. Your Supervisor Service bundle becomes the value of the `spec.package` field (or a selector pointing to a ConfigMap) inside a [`SupervisorService`](element-types/supervisor-service.md) CR.
2. That CR lives inside a VCF Service bundle alongside any other CRs your service needs (RBAC, UI plugin, API extension, etc.).
3. Follow the [Packaging and Distribution](lifecycle/packaging-and-build.md) guide to wrap everything into a VCF Service tarball.
4. Consult the [Upgrade and Deletion](lifecycle/upgrade.md) guide for managing the post-installation lifecycle.

### I want to understand how dynamic configuration injection works

Read the [Runtime Spec and Overlay](lifecycle/runtime-spec.md) guide, which explains how selector-based fields are resolved at reconciliation time and how `Overlay` CRs inject runtime values (such as a live IP address or a generated certificate) into other CRs.

### I need to understand the low-level platform primitives

Start with the [Extensibility Platform Overview](extensibility-platform/extensibility-platform.md). If you are authoring a VCF Service, the corresponding element type documents cross-reference the relevant platform primitive.
