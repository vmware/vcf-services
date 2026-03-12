# Securing Supervisor Services: Image Signing and Verification

To ensure that Supervisor Service artifacts have not been tampered with and to verify that images originate from a trusted entity, service authors should sign their OCI artifacts.

Unsigned Supervisor Services may trigger a third-party software disclaimer in the vSphere UI. Furthermore, certain high-privilege service capabilities (such as accessing specific Supervisor components) are restricted to signed and trusted services.

## Signing Architecture

Supervisor Services leverage [cosign](https://github.com/sigstore/cosign) with traditional Public Key Infrastructure (PKI) to sign images.

### What to Sign

The following artifacts must be signed to be considered **Trusted**:

- **Service Package Bundles:** The Carvel [imgpkg](https://carvel.dev/imgpkg/) bundles.

> **Note:** Container images for standard vSphere Pods (workloads) do not strictly require signatures for installation.

## Prerequisites

Before you begin, ensure you have the following tools installed:

- [Carvel imgpkg](https://carvel.dev/imgpkg/)
- [Cosign CLI](https://github.com/sigstore/cosign)
- An OCI-compliant registry with write access.

## Step-by-Step Signing Workflow

### Step 1: Push Bundle to a Local/Dev Registry

Cosign signs artifacts directly in a registry. If your bundle is currently a local tarball, push it to your registry first:

```bash
imgpkg copy --tar your-service-bundle.tar --to-repo <REGISTRY_URL>/<PROJECT>/<NAME>
```

### Step 2: Get the Image Digest (Hash)

Always sign using the digest (SHA256) rather than a tag to ensure the signature remains valid even if the tag is moved.

```bash
# Capture the 'Bundle SHA' from the output
imgpkg describe -b <REGISTRY_URL>/<PROJECT>/<NAME>:<TAG>
```

### Step 3: Sign with Attached Certificate & Chain

Run the `cosign sign` command. You must include the `--certificate` and `--certificate-chain` flags to embed the identity metadata into the registry.

```bash
cosign sign --key private.key \
  --certificate cert.pem \
  --certificate-chain chain.pem \
  --tlog-upload=false \
  --timestamp-server-url http://timestamp.digicert.com/?alg=sha256 \
  <REGISTRY_URL>/<PROJECT>/<NAME>@sha256:<DIGEST>
```

**Key parameters:**

- **`--tlog-upload=false`:** Disables uploading to public transparency logs (required for private corporate environments).
- **`--timestamp-server-url`:** Highly recommended. Ensures the service remains "Trusted" on the Supervisor even after your certificate expires, as long as it was signed while the certificate was valid. The example uses a public TSA (`timestamp.digicert.com`); if you use your own PKI, provide an RFC 3161–compliant Time Stamp Authority URL for your environment.

### Step 4: Verify the Signature

There are several ways to check whether an image has a signature.

**Using imgpkg:**

```bash
imgpkg describe -b <REGISTRY_URL>/<PROJECT>/<NAME>@sha256:<DIGEST>
```

In the output, look for an image entry with **Type: Signature** and the `dev.sigstore.cosign/certificate` annotation.

**Using crane:**

```bash
crane manifest <REGISTRY_URL>/<PROJECT>/<NAME>:sha256-<DIGEST>.sig | jq .
```

**Using cosign:**

```bash
cosign download signature <REGISTRY_URL>/<PROJECT>/<NAME>@sha256:<DIGEST> | jq .
```

### Step 5: Distribute the Signed Bundle

When moving the bundle to a production registry or preparing it for a customer's air-gapped environment, the signatures (and attached certificates) must be copied along with the bundle.

> **Important:** You **must** include the `--cosign-signatures` flag when using `imgpkg copy`. Without it, the signature and certificates are not copied, and the relocated bundle will not be considered signed/trusted on the Supervisor.

```bash
imgpkg copy -b <DEV_REGISTRY>/<PROJECT>/<NAME>@sha256:<DIGEST> \
  --to-repo <PROD_REGISTRY>/<PROJECT>/<NAME> \
  --cosign-signatures
```

## Trusting Custom Certificates on Supervisor

By default, the vSphere Supervisor trusts images signed by Broadcom-certified authorities and by well-known public trusted CAs.

If you use **custom or private PKI**, the Supervisor must trust the relevant Root CAs to verify your signed bundles. This applies in two cases:

| What | When custom CA trust is needed |
|------|---------------------------------|
| **Signer certificate** | Your signing certificate is issued by a custom/private CA. The Supervisor needs the signer’s Root CA to verify the image signature. |
| **TSA (Time Stamp Authority)** | You use a private or corporate timestamp server (e.g. your own RFC 3161 TSA). If the TSA’s certificate is issued by a custom CA, the Supervisor needs that Root CA to verify the timestamp on the signature. |

Provide the required Root CA certificate(s) to the Supervisor so it can verify both the signature and, when present, the timestamp. Configuration of custom CA trust is expected to be available from the UI in a future release. Until then, work with your platform administrator.
