# Supervisor Service Development Guide

1. [Introduction](introduction.md) — What a Supervisor Service is, why build one, lifecycle, versioning, and packaging.
2. [Authoring Carvel Supervisor Services](carvel/dev-guide.md) — Build bundles, PackageMetadata, and Package.
   - [Environment-Aware Services](carvel/environment-aware.md) — SupervisorProperties and valuesSchema.
   - [Private Registries](carvel/private-registry.md) — Placeholder secrets and imagePullSecrets.
   - [Compatibility Checks](carvel/compatibility.md) — Version and capability constraints.
3. [Image Signing and Verification](security/image-signing.md) — Sign with cosign; verify and distribute.

---

## Introduction

**Supervisor Services** are a versioned way to extend VMware Cloud Foundation (VCF) by integrating your capability natively into the Supervisor—surfacing it in the Service Catalog, upgrade workflows, and management APIs.

You do not need a Supervisor Service merely to run a workload in VCF; this guide focuses on the use case of extending the Supervisor with a lifecycle-managed service. For broader context on VCF services, see the general VCF documentation.

## Why Build a Supervisor Service?

If you are building Kubernetes-native software, turning it into a Supervisor Service provides:

- **API:** Your service can extend the Supervisor / VCF Automation Kubernetes API natively.
- **Integrated Consumption:** Your service appears in the Service Catalog so admins can install it on one or more Supervisors with a single workflow.
- **Platform-orchestrated lifecycle:** The Supervisor orchestrates deployment, upgrades, and health; customers do not need to run `kubectl` or other client commands to keep the service running.
- **Isolation:** Each service instance runs in a dedicated, secure namespace with strict resource boundaries.
- **Environment Awareness:** Your application can adapt to its environment (e.g. networking stack, control plane size, cluster Virtual IP) via [SupervisorProperties](carvel/environment-aware.md) injection, without environment-specific hardcoding.

## The Service Lifecycle

The path from your code to a running service follows a structured pipeline across the VCF management plane.

| Phase | Developer Action | Platform Action |
|-------|-------------------|-----------------|
| **1. Package** | Bundle manifests, images, and metadata into a distributable unit. | — |
| **2. Publish** | Ship two artifact types to separate destinations:<br>(1) **Service definition** to a location administrators can access.<br>(2) **OCI bundle** (manifests and images) to a container registry. | — |
| **3. Register** | — | A user with the `SupervisorServices.Manage` vCenter privilege downloads the service definition manifest and registers it with vCenter/VCF;<br>the platform validates and makes it discoverable. |
| **4. Install** | — | A user with the `SupervisorServices.Install` vCenter privilege selects Supervisor(s) and provides required configuration. |
| **5. Deploy** | — | The platform installs the service on the Supervisor. |
| **6. Maintain** | Ship new versions. | Manages upgrades and health. |

## Versioning

Supervisor Services follow [Semantic Versioning](https://semver.org/). You can upgrade to a newer version via the UI or APIs; the platform does not support downgrades—the lifecycle is forward-only.

## Packaging

Packaging is the process of transforming your Kubernetes manifests, container images, and configurations into a distributable unit that VMware Cloud Foundation (VCF) can discover, validate, and deploy. The platform currently uses [Carvel](https://carvel.dev/) for packaging. For step-by-step Carvel authoring, see [Authoring Supervisor Services](carvel/dev-guide.md).

Every Supervisor Service package consists of these core elements:

| Component | Purpose |
|-----------|---------|
| **Service Identity** | The service metadata: identifier (a unique, fully qualified name), display name, and description that appear in the Service Catalog. |
| **Versioned Installer** | The version-specific manifest that references the payload, declares any compatibility constraints, and exposes the configuration schema that admins fill in at install time. |
| **The Payload** | An immutable bundle of Kubernetes manifests and locked container image digests. What you test is exactly what the customer deploys. |

## Securing

Signing your bundle lets the Supervisor verify, before installation, that the artifact came from a trusted publisher and was not modified in transit or in the registry. Unsigned bundles still install but trigger a third-party software disclaimer in the UI, and certain high-privilege capabilities are reserved for bundles that the Supervisor can verify as trusted.

See [Image Signing and Verification](security/image-signing.md) for the signing model, prerequisites, and the end-to-end workflow.

