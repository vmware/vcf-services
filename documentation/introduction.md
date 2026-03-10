# Introduction

A Supervisor Service is the standard way to deliver your software as a managed, native platform capability. By packaging your solution as a Supervisor Service, you enable administrators to deploy and manage your application across the VMware Cloud Foundation (VCF) ecosystem using standardized APIs and management interfaces.

## Why Build a Supervisor Service?

If you are building Kubernetes-native software, turning it into a Supervisor Service provides:

- **Integrated Consumption:** Your service is surfaced in a centralized Service Catalog, allowing admins to enable it on one or more Supervisors with a single workflow.
- **Lifecycle as a Service:** The platform manages deployment, health monitoring, and dependency reconciliation.
- **Enterprise Isolation:** Each service instance runs in a dedicated, secure namespace with strict resource boundaries.
- **Environment Awareness:** Your application can adapt to its environment (e.g. networking stack, control plane size, cluster Virtual IP) via SupervisorProperties injection, without environment-specific hardcoding.

## The Service Lifecycle

The path from your code to a running service follows a structured pipeline across the VCF management plane.

| Phase | Developer Action | Platform Action |
|-------|-------------------|-----------------|
| **1. Package** | Bundle manifests, images, and metadata into a distributable unit. | — |
| **2. Publish** | Ship two artifact types to separate destinations:<br>(1) **Service definition** to a location admins can access.<br>(2) **OCI bundle** (manifests and images) to a container registry. | — |
| **3. Register** | — | Admin downloads and registers the service to vCenter/VCF;<br>platform validates and makes it discoverable. |
| **4. Enable** | — | An admin selects Supervisor(s) and provides required config. |
| **5. Deploy** | — | The platform pulls artifacts and reconciles state on the Supervisor. |
| **6. Maintain** | Ship new versions. | Manages upgrades and health. |

## Versioning

Supervisor Services follow [Semantic Versioning](https://semver.org/). You can **upgrade** to a newer version via the UI or APIs; the platform does **not** support **downgrades**—the lifecycle is forward-only.

## Packaging

Packaging is the process of transforming your Kubernetes manifests, container images, and configurations into a distributable unit that VMware Cloud Foundation (VCF) can discover, validate, and deploy The platform currently uses [Carvel](https://carvel.dev/) for packaging. For step-by-step Carvel authoring, see [Authoring Carvel Supervisor Services](carvel/dev-guide.md).

Every Supervisor Service package consists of these core elements:

| Component | Purpose |
|-----------|---------|
| **Service Identity** | The "storefront" metadata: display name, description, and icons that appear in the Service Catalog. |
| **Versioned Installer** | Defines specific versions and their requirements. Maps your payload to the configuration schema an admin will interact with. |
| **The Payload** | An immutable bundle of Kubernetes manifests and locked container image digests. What you test is exactly what the customer deploys. |
| **Configuration Schema** | An OpenAPI-based definition of variables. Lets the platform validate admin input and inject values. |

## Securing

The **Securing** section covers image signing and verification. Signing lets users of the service know that the artifacts come from a trusted source. See [Image Signing and Verification](security/image-signing.md).
