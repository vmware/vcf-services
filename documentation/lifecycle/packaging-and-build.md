# Packaging and Distribution

This document covers the complete packaging and distribution workflow for VCF Services: bundle structure, the Carvel-based build process, distribution channels, compatibility validation, and installation value generation.

## What Is a VCF Service?

A VCF Service is a Carvel package with specific constraints designed for VCF Automation. It can only contain:

- Custom Resources under the `services.vcfa.broadcom.com/v2` API group
- Kubernetes `Secret` resources for configuration

Each CR materialises a particular VCF extensibility element - either within VCF Automation, vCenter, or a Supervisor cluster. Supported CR kinds are: `SupervisorService`, `SupervisorRegistry`, `Overlay`, `GlobalRole`, `Role`, `RightBundle`, `VcfaServiceAccount`, `VcServiceAccount`, `ApiExtension`, `ApiExtensionProxy`, `RelyingParty`, `UserInterfacePlugin`, and `RdeBundle`.

---

## Bundle Layout

### Directory Structure

```text
<service-name>/
  package.yml              # PackageMetadata + Package CRs (template - image URL resolved at build time)
  config/
    values.yml             # ytt data values schema (#@data/values)
    vcf-service.yml        # Main entry point template
    *.lib.yml              # ytt library files
    *.star                 # Starlark helpers
  .imgpkg/
    images.yml             # ImagesLock describing required OCI artifacts
  .values/
    render.yml             # Concrete values for build-time rendering (not shipped at runtime)
    transpiler.yml         # Transform Service Manager inventory to service values (conditional)
  .install/                # (optional) Install-time UI plugin dependencies
    dependencies.yml
```

### Component Descriptions

| Component | Purpose | Required |
| :---- | :---- | :---- |
| `package.yml` | Service metadata and OpenAPIv3 input value schema | Yes |
| `config/values.yml` | ytt data values schema; defines what inputs the service accepts | Yes |
| `config/` templates | ytt templates rendering `services.vcfa.broadcom.com/v2` CRs | Yes |
| `.imgpkg/images.yml` | Content-addressed references to all OCI artifacts (UI plugins, Supervisor Service bundles) | Yes |
| `.values/render.yml` | Concrete example values used at build time so `kbld` can resolve every image reference | Yes |
| `.values/transpiler.yml` | ytt template that converts the Service Manager inventory into service input values | Required when the service input schema differs from the framework schema |
| `.install/dependencies.yml` | Install-time UI plugin image references for the Service Manager | Conditional |

### Framework Conventions

Every bundle must include `./package.yml` at its root. This enables the bundle to be used in offline scenarios and uploaded directly into VCF Automation. The `imgpkgBundle.image` field in `package.yml` is left empty in the source tree and resolved to a concrete depot URL at build time.

The `.values/render.yml` file must contain concrete values that activate **all** optional resources, so that `kbld` can discover and lock every image reference that may appear at runtime.

### `package.yml` Example

The source-tree `package.yml` contains both `PackageMetadata` and `Package` CRs. The `metadata.name`, `spec.refName`, `spec.version`, and `spec.template.spec.fetch[0].imgpkgBundle.image` fields are populated by the build process - they are left empty in the source tree.

```yaml
---
apiVersion: data.packaging.carvel.dev/v1alpha1
kind: PackageMetadata
metadata:
  name: arcturus.example.com              # populated at build: <name>.<version>
  labels:
    services.vcfa.broadcom.com/can-auto-scale-regions: "false"
    services.vcfa.broadcom.com/can-auto-scale-supervisors: "true"
spec:
  displayName: "Arcturus"
  shortDescription: "OCI Registry"
  longDescription: "Regional OCI registry deployed on Supervisor clusters."
  providerName: Corp
---
apiVersion: packaging.carvel.dev/v1alpha1
kind: Package
metadata:
  name: arcturus.example.com              # populated at build
spec:
  refName: arcturus.example.com           # populated at build
  version:                               # populated at build
  template:
    spec:
      fetch:
      - imgpkgBundle:
          image:                         # left empty in source tree; resolved to a registry URL at build time
      template:
      - ytt:
          paths: ["config/"]
      - kbld:
          paths: ["-", ".imgpkg/images.yml"]
      deploy:
      - kapp: {}
  valuesSchema:
    openAPIv3:
      title: arcturus values schema
      properties:
        regions:
          type: array
          description: Collection of regional configurations.
          items:
            type: object
            properties:
              name:
                type: string
                description: Region name.
              hostSupervisor:
                type: object
                description: Host Supervisor configuration for this region.
```

### `.values/transpiler.yml` Example

The transpiler is a ytt template bundled with the service that converts the Service Manager inventory object into the service's own input schema. It is required when the service's `valuesSchema` differs from the structure of the inventory document provided by the framework.

```yaml
#@ load("@ytt:data", "data")

#! Transform Service Manager Inventory to service values
---
#@ def merge_regions():
#@   result = []
#@   for region in data.values.regions:
#@     result.append({
#@       "name": region.name,
#@       "hostSupervisor": {
#@         "name": region.supervisors[0].name,
#@         "configuration": {
#@           "persistence": {
#@             "persistentVolumeClaim": {
#@               "registry": {
#@                 "storageClass": region.supervisors[0].defaultStorageClass,
#@                 "size": "10Gi"
#@               }
#@             }
#@           }
#@         }
#@       },
#@       "clientSupervisors": [s.name for s in region.supervisors]
#@     })
#@   end
#@   return result
#@ end

---
regions: #@ merge_regions()
```

---

## Build Process

The build is driven by a `Makefile`. Running `make build` from the service directory executes all steps in order.

### What the Build Does

```text
1. Prepare the build directory
   Copy the bundle source tree into dist/ and initialise
   the system data values file (config/.vcf/dependencies.yml).

2. Resolve Supervisor Service dependencies  [if SupervisorService is included]
   Copy the Supervisor Service imgpkg bundle to the build registry.
   Inject the resulting Package and PackageMetadata CRs into the
   system data values file so your ytt templates can reference them.

3. Stamp the package metadata
   Write the final name and version into package.yml.

4. Lock all image references
   Render your ytt templates with the example values from .values/render.yml,
   then run kbld to resolve every image reference to a content-addressed digest
   and write the result into .imgpkg/images.yml.

5. Push the bundle
   Push the built bundle directory to an OCI registry with imgpkg.

6. Sign the bundle  (see Signing below)

7. Package into a self-contained tarball
   Copy the bundle and all referenced images into a single portable .tar file.
```

### Prerequisites

| Tool | Purpose |
| :---- | :---- |
| `ytt` | Renders YAML templates with data values |
| `kbld` | Resolves and locks image references |
| `imgpkg` | Packages and distributes OCI bundles |
| `cosign` | Signs OCI artifacts |
| `yq` | YAML processor used by the Makefile |
| OCI registry (writable) | Staging registry used during the build |

### Signing

Unsigned service bundles may trigger a third-party software disclaimer in the vSphere UI. Additionally, certain high-privilege capabilities (such as accessing specific Supervisor components) are restricted to signed and trusted services. Always sign production builds.

Cosign uses traditional PKI: you need a private key, a signing certificate, and optionally a certificate chain.

#### Get the Image Digest

Always sign using the content-addressed digest rather than a tag. This ensures the signature remains valid even if the tag is later moved.

```shell
# The digest is printed by imgpkg push in the previous step.
# To retrieve it explicitly:
imgpkg describe -b "${BUNDLE_REPO}"
# Look for 'Bundle SHA' in the output.
```

#### Sign with Certificate and Chain

Include `--certificate` and `--certificate-chain` to embed identity metadata into the registry alongside the signature.

```shell
DIGEST="<sha256-from-previous-step>"

cosign sign \
  --key private.key \
  --certificate cert.pem \
  --certificate-chain chain.pem \
  --tlog-upload=false \
  --timestamp-server-url "http://timestamp.digicert.com/?alg=sha256" \
  "${BUNDLE_REPO}@sha256:${DIGEST}"
```

**Key parameters:**

- **`--tlog-upload=false`** - Disables uploading to public transparency logs. Required for private corporate environments.
- **`--timestamp-server-url`** - Highly recommended. Embeds an RFC 3161 timestamp so the service remains trusted on the Supervisor even after the signing certificate expires, as long as it was signed while the certificate was valid. Replace the example URL with your own corporate TSA if you use private PKI.

> **Note:** Container images for standard vSphere Pod workloads do not strictly require signatures for installation.

#### Verify the Signature

Confirm the signature was attached correctly before proceeding.

**Using imgpkg** - look for an entry with `Type: Signature` and a `dev.sigstore.cosign/certificate` annotation:

```shell
imgpkg describe -b "${BUNDLE_REPO}@sha256:${DIGEST}"
```

**Using crane:**

```shell
crane manifest "${BUNDLE_REPO}:sha256-${DIGEST}.sig" | jq .
```

**Using cosign:**

```shell
cosign download signature "${BUNDLE_REPO}@sha256:${DIGEST}" | jq .
```

### Creating the Tarball

```shell
BUNDLE_TAR="./dist/arcturus-${VERSION_TAG}.tar"

imgpkg copy \
  --bundle "${BUNDLE_REPO}" \
  --to-tar "${BUNDLE_TAR}" \
  --cosign-signatures \
  --registry-verify-certs=false
```

> **Important:** Always include `--cosign-signatures` when copying with `imgpkg copy`. Without it, signatures and attached certificates are not included in the tarball, and the relocated bundle will not be considered signed or trusted on the Supervisor.

The tarball embeds the full bundle, all referenced OCI images, and all cosign signatures. To load it into a target registry in an air-gapped environment:

```shell
imgpkg copy \
  --tar "${BUNDLE_TAR}" \
  --to-repo "internal-registry.example.com/vcf-services/arcturus" \
  --cosign-signatures \
  --registry-verify-certs=false
```

### Trusting Custom Certificates on Supervisor

By default, the vSphere Supervisor trusts images signed by well-known public CAs. If you use **custom or private PKI**, the Supervisor must trust the relevant root CAs to verify your signatures.

| What | When custom CA trust is needed |
| :---- | :---- |
| Signer certificate | Your signing certificate is issued by a custom or private CA. The Supervisor needs the signer's root CA to verify the image signature. |
| TSA (Time Stamp Authority) | You use a private or corporate timestamp server. If the TSA's certificate is issued by a custom CA, the Supervisor needs that root CA to verify the timestamp on the signature. |

Provide the required root CA certificate(s) to the Supervisor so it can verify both the signature and, when present, the embedded timestamp. Work with your platform administrator to configure custom CA trust.

---

## Distribution Channels

| Channel | Description | Connectivity |
| :---- | :---- | :---- |
| Built-In | Shipped as part of the VCF Automation release | Offline |
| Direct upload | Bundle tarball uploaded via the VCF Automation API | Offline |

### Built-In Services

Built-in services are delivered as part of the VCF Automation release itself. They are:

- Automatically registered as service cards in VCF Automation on startup
- Validated through VCF Automation release pipelines
- Compatible by default - no additional compatibility check required
- Available offline via the internal VCFA registry without any external connectivity

Built-in services are the recommended path for core services that must be available in air-gapped environments from day one.

### Direct Upload

Any service packaged as a bundle tarball can be uploaded directly via the VCF Automation API:

```http request
POST /v2/vcf-services
Content-Type: application/json

{ "source": "https://example.com/my-service-1.2.3.tar" }
```

The Service Manager downloads and registers the bundle, validates its CRs, and makes it available for activation.

---

## Compatibility Checks

### Static Compatibility

Before a service is registered in VCF Automation, its resource definitions are statically validated:

- Built-in services are compatible by default; they are validated as part of the VCF Automation release pipeline.
- Uploaded services are statically analysed at registration time: resource definitions are validated against supported CRD versions, API version compatibility is checked, and the value schema is inspected.

### Dynamic Compatibility

After registration, VCF Service Manager validates compatibility with the target systems (VCF Automation, vCenter, and Supervisor) before allowing installation to proceed:

1. Resources are staged in the target systems.
2. Pre-checks are executed at each destination.
3. Failures are surfaced under the affected element and rolled up into the overall service status.

`UserInterfacePlugin` and `SupervisorService` resources include additional binary compatibility checks beyond schema validation.

---

## Installation Value Generation

When a service is installed, VCF Service Manager constructs the effective installation values by processing five layers in order:

```text
1. Inventory
   └─► Service Manager YAML document
   └─► Current state: regions, supervisors, storage classes, tenants

2. Platform Overlay (Provider Overlay)
   └─► Scoping YAML from the VCFA Service Manager
   └─► Filters the inventory down to the relevant scope

3. Vendor Overlay (Transpiler)
   └─► .values/transpiler.yml bundled with the VCF Service
   └─► Converts the filtered inventory into the service's own input schema
   └─► Must produce output compatible with the service's OpenAPIv3 valuesSchema

4. User Overwrite (Provider Overwrite)
   └─► Created during manual installation
   └─► Overrides auto-generated values with provider-specific customisations

5. ytt Processing
   └─► All layers are merged and processed at runtime
   └─► Produces the effective installation values passed to the package
```

This multi-layer approach enables automatic value generation across multiple regions, multiple Supervisors per region, multiple tenants, and dynamic infrastructure changes - without requiring the vendor to know the topology at bundle authoring time.

### Inventory Document Structure

The Service Manager inventory is the foundational input to the value generation pipeline:

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
                protocol: TCP
    storageClasses:
      - platinum
      - gold
      - silver
```

The transpiler (`.values/transpiler.yml`) receives this document under `data.values.inventory` and maps it to the fields expected by the service's `valuesSchema`.

---

## Best Practices

### Bundle structure

- Keep `config/` templates modular - one file per concern (e.g. `supervisor-service.yml`, `roles.yml`, `service-account.yml`).
- Define a complete OpenAPIv3 `valuesSchema` in `package.yml`. Document all parameters with `description` fields and provide sensible defaults.
- Include example values in `.values/values.yml` that cover all optional resources so `kbld` can lock every image at build time.
- Keep transpiler logic simple and document the inventory-to-values mapping. Handle missing or nil inventory fields gracefully with fallback defaults.

### Packaging

- Automate the full build process with a `Makefile` or script; avoid manual steps.
- Validate rendered output with `ytt --strict` before proceeding to `kbld`.
- Verify `images.yml` completeness before pushing the bundle.
- Always sign production builds. Store private keys in a secrets manager; never commit them to source control.

### Versioning

- Use semantic versioning (`MAJOR.MINOR.PATCH`) for the service version.
- Carvel package versions with a `+` qualifier (e.g. `1.2.3+galaxy.1`) must use `_` in place of `+` when used as Docker image tags.
- Document each release in the `releaseNotes` field of `package.yml`.
- Test upgrade paths from previous versions before publishing.

### Distribution

- Use a consistent OCI image tagging scheme across all registries.
- Maintain content-addressed digests in `images.yml` - never rely on mutable tags.
- Test offline installation scenarios before shipping; verify all dependencies are included in the tarball.
- Replicate bundles to regional registries to reduce pull latency during Supervisor installation.

## Related Documents

- [VCF Service Overview](vcf-service-overview.md) - lifecycle states and architecture
- [Filesystem Layout](filesystem-layout.md) - bundle and VCF Service tarball directory structure
- [Extensions Overview](../extensions/element-types-overview.md) - all supported CR types
- [Upgrade](upgrade.md) - post-installation lifecycle: upgrade, rollback, and deletion
