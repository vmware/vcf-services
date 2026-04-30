# VCF Service Lifecycle Overview

A VCF Service is a self-contained unit of extensibility for VMware Cloud Foundation Automation. It bundles all the configuration, metadata, and OCI artifacts needed to deploy a software service across one or more vSphere Supervisor clusters, and to integrate that service with the VCF Automation platform (RBAC, UI, API, OAuth).

## What Is a VCF Service?

At its core a VCF Service is a [Carvel](https://carvel.dev/) package with a specific set of constraints:

- It may only contain Kubernetes Custom Resources (CRs) from the `services.vcfa.broadcom.com/v2` API group, plus Kubernetes Secrets used for configuration.
- Each CR in the package describes the desired state of one VCF Automation extensibility element - a Supervisor package, a UI plugin, a service account, an API endpoint, and so on.
- The full list of supported CR kinds is documented in the [Extensions Overview](../extensions/element-types-overview.md).

When a VCF Service is activated, the VCF Service Manager creates all the CRs declared in the package and a set of controllers continuously reconcile each CR against its target system until the service reaches a `Healthy` state.

## Key Concepts

***Bundle*** = the source directory that a service author maintains in version control; it contains templates, metadata, and image references.

***Package*** = the processed, immutable OCI artifact pushed to a registry; the bundle rendered and locked with content-addressable image digests.

***Bundle tarball*** = the portable distribution format (`*.tar`) produced by `imgpkg copy --to-tar`; it embeds the full imgpkg bundle and all referenced OCI images.

***Service Manager*** = the operator running inside VCF Automation that reconciles all `services.vcfa.broadcom.com/v2` CRs.

## Service Lifecycle States

A VCF Service progresses through the following states from the perspective of a VCF Automation administrator:

```
Created (via API POST)
    │
    ▼
inactive  ◄────────────────────────────────────┐
    │                                          │
    │  Administrator accepts EULA, signatures, │
    │  and access grants; PATCH → active       │
    ▼                                          │
active  ─────────────────── PATCH → inactive ──┘
    │
    ├─ PATCH → paused  (reconciliation suspended)
    │       │
    │       └─ PATCH → active  (resume)
    │
    └─ DELETE → decommissioned → deleted
```

| State | Description |
| :---- | :---- |
| `inactive` | Service exists in the system but controllers are not reconciling its CRs |
| `active` | Controllers reconcile CRs; the service is running or still being deployed |
| `paused` | Reconciliation temporarily suspended (e.g. during manual maintenance) |
| `decommissioned` | Deletion in progress; CRs are being torn down |

Each individual CR within an active service independently reports its own status (`Healthy`, `Busy`, `Unhealthy`, `Maintenance`). The overall service health is derived from the aggregate CR status.


## Service Installation Value Generation

When an administrator activates a service, VCF Service Manager generates the installation values that populate the CR templates through five layers applied in order:

| Layer | Source | Description |
| :---- | :---- | :---- |
| 1. Inventory | Service Manager | Live snapshot of regions, Supervisors, storage classes, and tenants |
| 2. Platform Overlay | Service Manager | Scoping filter applied by the provider to the inventory |
| 3. Vendor Overlay (Transpiler) | Bundled with the service | Converts the filtered inventory into values conforming to the service's OpenAPI v3 schema |
| 4. User Overwrite | Entered during installation | Provider-specific overrides applied on top of the auto-generated values |
| 5. ytt Processing | Runtime | All layers assembled and rendered by ytt into the final effective values |

The Inventory document delivered to the transpiler has this structure:

```yaml
regions:
  - name: us-west-1
    supervisors:
      - name: supervisor-vc1
        id: domain-c8
        version: 9.0.1234
        defaultStorageClass: vks-content-library
        vcenterName: vcenter1.example.com
        vcenterId: vc-uuid-123
        managementServices:
          vcf-depot:
            addresses: [10.0.1.100]
            caChain: "-----BEGIN CERTIFICATE-----\n..."
            ports:
              https:
                port: 443
    storageClasses:
      - platinum
      - gold
```


## Component Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     VCF Automation                       │
│  ┌───────────────────────────────────────────────────┐   │
│  │              Service Manager                      │   │
│  │                                                   │   │
│  │   Controllers          API Server (REST)          │   │
│  │   ├ SupervisorService  └ /v2/vcf-services         │   │
│  │   ├ Overlay                                       │   │
│  │   ├ UserInterfacePlugin                           │   │
│  │   ├ RdeBundle                                     │   │
│  │   ├ ApiExtension                                  │   │
│  │   ├ GlobalRole / Role / RightBundle               │   │
│  │   ├ VcfaServiceAccount / VcServiceAccount         │   │
│  └───────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────┘
                             │  reconciles
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   VCF Automation API    vCenter API     Supervisor API
   (RBAC, RDE, OAuth,    (service        (Carvel packages,
    UI plugins, API ext)  accounts,       registry config,
                          roles)          applied resources)
```

## Related Documents

- [Filesystem Layout](filesystem-layout.md) - bundle and service tarball directory structure
- [Packaging and Build](packaging-and-build.md) - step-by-step build, package, and sign workflow
- [Extensions Overview](../extensions/element-types-overview.md) - all supported CR types and common patterns
