# VCF Services

Developer documentation and SDK release tooling for **VMware Cloud Foundation (VCF) Services** — the packaging and lifecycle management framework for deploying software services across the VCF Automation fleet.

---

## Overview

A **VCF Service** bundles all configuration, OCI artifacts, and platform integration declarations needed to install, operate, and upgrade a service across one or more vSphere Supervisor clusters — spanning multiple regions and tenant organisations — from a single control plane inside VCF Automation. It is not just a Kubernetes package: it is a complete extensibility contract with VCF Automation that covers fleet-scale deployment, multi-tenancy, RBAC, UI integration, API extensibility, and lifecycle management.

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

A **Supervisor Service** is a versioned, lifecycle-managed workload scoped to a single vSphere Supervisor cluster. It can be used standalone or wrapped inside a VCF Service to bring it under VCF Automation fleet management.

| | VCF Services | Supervisor Services |
| :--- | :--- | :--- |
| **Scope** | Fleet — multiple Supervisors, regions, and tenants | Single Supervisor cluster |
| **Control plane** | VCF Automation Service Manager | vSphere / Supervisor directly |
| **Platform integration** | Full (RBAC, UI, API, OAuth, RDE, multi-tenancy) | Kubernetes workloads only |

---

## Getting Started

See the [Development Guide](documentation/overview.md) and the full [Table of Contents](documentation/toc.md).

---

## License

See [LICENSE](LICENSE).
