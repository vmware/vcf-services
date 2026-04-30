# Securing Supervisor Services: Image Signing and Verification

To ensure your Supervisor Service artifact has not been tampered with and to demonstrate that it originates from a trusted publisher, you should sign the Carvel `imgpkg` bundle that backs each service version.

Unsigned Supervisor Services trigger a third-party software disclaimer in the UI, and certain high-privilege capabilities are restricted to bundles the Supervisor can verify as trusted.

## Signing model at a glance

The Supervisor verifies bundle signatures with [cosign](https://github.com/sigstore/cosign) + traditional Public Key Infrastructure (PKI):

- The signature is attached to the bundle as a separate cosign artifact in the same repository.
- The Supervisor extracts the leaf certificate and chain embedded in the signature and validates the chain against its trust pool.
- Supervisor does not yet support extending its trust pool with custom CA. The bundle has to be signed with a publicly trusted CA or Broadcom public certificate (first-party services only).
- The Supervisor ignores the transparency log during verification.
- It does not yet support trusted timestamps to extend trust past certificate expiry; the certificate must be **currently valid** at the time the Supervisor checks the signature.

### What gets signed

Sign the `imgpkg` bundle that the Carvel `Package` references in `spec.template.spec.fetch[].imgpkgBundle.image`. This is the only artifact the Supervisor verifies.

You do not need to individually sign the container images inside the bundle — those are integrity-protected by the bundle's own digest manifest once the bundle itself is trusted.


## Trust and certificate chains

The Supervisor only accepts signatures whose embedded leaf certificate chains to a root in its built-in trust pool. We plan to support custom CA in future.

- **Use a publicly trusted CA.** If your organization signs with a certificate issued by a widely trusted public CA, the Supervisor will accept it.
- **First-party (Broadcom-published) services** sign with a Broadcom internal CA that is already in the Supervisor's trust pool. This path is not available for third-party publishers.
- **Self-signed or private-CA signatures will be rejected.** Until custom-CA trust is supported, signing your bundle with a private CA causes the Supervisor to treat the bundle as untrusted.

## Prerequisites

| Tool | Purpose |
|------|---------|
| [`imgpkg`](https://carvel.dev/imgpkg/) | Build, push, copy bundles |
| [`cosign`](https://github.com/sigstore/cosign) | Sign and inspect signatures |
| [`crane`](https://github.com/google/go-containerregistry/blob/main/cmd/crane/README.md) (optional) | Inspect manifests directly |
| an OCI-compliant registry | Host the imgpkg bundle and its signature |

## Step-by-step signing workflow

### Step 1: Get your bundle into a registry

Cosign signs artifacts in the registry, so the bundle must already exist as an OCI image.

```bash
imgpkg copy --tar my-service-bundle.tar --to-repo <REGISTRY>/<REPO>
```

### Step 2: Resolve the bundle to a digest

Always sign **by digest**, not by tag — if the tag moves, a tag-based signature no longer matches what customers pull.

```bash
imgpkg describe -b <REGISTRY>/<REPO>:<TAG>
```

<details>
  <summary>Sample `imgpkg describe` output</summary>

```bash
$ imgpkg describe -b projects.packages.broadcom.com/tkg/packages/standard/contour:v1.28.2_vmware.1-tkg.1
Bundle SHA: sha256:ac665d3d0256f70c5272a593421ff3ef4532e98409bca7a72275befdfd3861be    <======

Images:
  - Image: projects.registry.vmware.com/tkg/contour@sha256:d9d7063e1d11f1a518378aedc719f234a808109fbce6fb52701064c9b800c050
    Type: Image
    Origin: projects.registry.vmware.com/tkg/contour@sha256:d9d7063e1d11f1a518378aedc719f234a808109fbce6fb52701064c9b800c050
    Layers:
      - Digest: sha256:b4b933e428f5fd980733cf04da04c3e87350bf52a94797e774683b3688e64c54
    Annotations:
      kbld.carvel.dev/id: ghcr.io/projectcontour/contour:v1.28.2
      kbld.carvel.dev/origins: - resolved:
          tag: v1.28.2_vmware.1
          url: projects.registry.vmware.com/tkg/contour:v1.28.2_vmware.1

  - Image: projects.registry.vmware.com/tkg/envoy@sha256:a941610f98381083870953ede2d14d90b52c16f9b9f72b3158ccbbdf8c0bd608
    Type: Image
    Origin: projects.registry.vmware.com/tkg/envoy@sha256:a941610f98381083870953ede2d14d90b52c16f9b9f72b3158ccbbdf8c0bd608
    Layers:
      - Digest: sha256:2369c33f073ae935e1a0a5c3512446e661b865029a2a07941ee6c3c03d99da75
      - Digest: sha256:2b776ada03417eaa87102a617f964324df1de8967698fc4209dc1a1fbdfae8cd
      - Digest: sha256:2a977872b36c1a2309fac8bd22b0fa0b3ee6efd1a25af5016ee9409beca1b3cf
      - Digest: sha256:54e6e6b3b3915686a45868275ea2e3a1195571182f288ac23a31ee6f8fe75c87
      - Digest: sha256:ab4403e442bffb2ce0a44f9463d0891337d0784e2d5d50f0677e903622591609
      - Digest: sha256:86d03bd6344168c148233c4f8adaf4b89aa08c01a05d30269ed367f113794ca7
      - Digest: sha256:52873439a13501a6a358c47eefe68330258edbf019125aec597b713deb259bb5
      - Digest: sha256:68d6cfd04225ec378e86f390e84392094483e5e35386baea4ce1becf4d570709
      - Digest: sha256:4aa0ea1413d37a58615488592a0b827ea4b2e48fa5a77cf707d0e35f025e613f
      - Digest: sha256:5dbac4f9d635b61bbe48d8ac04943a22c0ae53927f84997891e16a8cacfebe20
      - Digest: sha256:5d12877714b4438a7621b98d097e0a80224a5e190ab425575f875ced845640b9
      - Digest: sha256:ffb78650e67985c615ddc88e82487cf2feda34bdff5ba9fa295523af3b63f36f
      - Digest: sha256:8e7e39f179d898f2fee3ae36f4e5d98e198547974bfefdabb7b9b06a18ffa66d
    Annotations:
      kbld.carvel.dev/id: docker.io/envoyproxy/envoy:v1.29.2
      kbld.carvel.dev/origins: - resolved:
          tag: v1.29.2_vmware.1
          url: projects.registry.vmware.com/tkg/envoy:v1.29.2_vmware.1


Succeeded
```

In the output, find `Bundle SHA:`. Copy the full digest including the `sha256:` prefix; that value is `<DIGEST>` for the next steps.


</details>


### Step 3: Sign with attached certificate and chain

Use a leaf signing certificate and chain that chain to a root the **Supervisor already trusts** (see [Trust and certificate chains](#trust-and-certificate-chains) below). File-based keys are the usual approach for local and CI signing:

```bash
cosign sign \
  --key private.key \
  --certificate cert.pem \
  --certificate-chain chain.pem \
  --tlog-upload=false \
  <REGISTRY>/<REPO>@<DIGEST>
```

**Notes on the flags:**

- **`--key`, `--certificate`, `--certificate-chain`** — the Supervisor expects cosign signatures that carry the leaf cert and chain so it can walk trust to a known root.
- **`--tlog-upload=false`** — optional policy choice. The Supervisor does not rely on the public Rekor log for verification; setting `false` avoids publishing your bundle digest to Rekor.

### Step 4: Verify the signature is published

Pick one of these checks.

#### Using `imgpkg`

```bash
imgpkg describe -b <REGISTRY>/<REPO>@<DIGEST>
```
<details>
<summary>Sample `imgpkg describe` output with explanation</summary>


The transcript below is from a real signing run against a [Contour](https://projectcontour.io/) supervisor-service bundle pushed to a local test registry on `localhost:5123`. Use it as a reference for the shape of the output.

```bash
imgpkg describe -b localhost:5123/contour@sha256:ac665d3d0256f70c5272a593421ff3ef4532e98409bca7a72275befdfd3861be
```

```text
Bundle SHA: sha256:ac665d3d0256f70c5272a593421ff3ef4532e98409bca7a72275befdfd3861be

Images:
  - Image: localhost:5123/contour@sha256:824f983f1bb5dcc3ca0cecc476beea3ee6f4fd1ed5378c9e8be5143ac09ed6d2
    Type: Signature
    Annotations:
      tag: sha256-ac665d3d0256f70c5272a593421ff3ef4532e98409bca7a72275befdfd3861be.sig
  - Image: localhost:5123/contour@sha256:91e9617a69f2a01f645c28cc4b2def569179c513a7155aa29909fa7eb272053b
    Type: Internal
  - Image: localhost:5123/contour@sha256:d9d7063e1d11f1a518378aedc719f234a808109fbce6fb52701064c9b800c050
    Type: Image
    Origin: projects.registry.vmware.com/tkg/contour@sha256:d9d7063e1d11f1a518378aedc719f234a808109fbce6fb52701064c9b800c050
    Annotations:
      kbld.carvel.dev/id: ghcr.io/projectcontour/contour:v1.28.2
      kbld.carvel.dev/origins: - resolved:
          tag: v1.28.2_vmware.1
          url: projects.registry.vmware.com/tkg/contour:v1.28.2_vmware.1

  - Image: localhost:5123/contour@sha256:a941610f98381083870953ede2d14d90b52c16f9b9f72b3158ccbbdf8c0bd608
    Type: Image
    Origin: projects.registry.vmware.com/tkg/envoy@sha256:a941610f98381083870953ede2d14d90b52c16f9b9f72b3158ccbbdf8c0bd608
    Annotations:
      kbld.carvel.dev/id: docker.io/envoyproxy/envoy:v1.29.2
      kbld.carvel.dev/origins: - resolved:
          tag: v1.29.2_vmware.1
          url: projects.registry.vmware.com/tkg/envoy:v1.29.2_vmware.1


Succeeded
```

- The bundle digest (`Bundle SHA: sha256:ac665d3d…3861be`) is the object you signed in Step 3.
- The **`Type: Signature`** row (`sha256:824f983f…ed6d2`) is the cosign signature object co-located in the same repo. Its `tag:` annotation (`sha256-ac665d3d…3861be.sig`) is the conventional cosign signature tag derived from the bundle digest — that is the same tag pattern you pass to `crane manifest …:<tag>` in Step 4.
- The **`Type: Internal`** row is the bundle's internal lockfile / manifest object; you don't sign it directly.
- Remaining **`Type: Image`** rows are the workload images recorded in `.imgpkg/images.yml`. They show their `Origin` (where they were pulled from at build time) and `kbld.carvel.dev/origins` (the original tag your manifests referenced before kbld pinned the digest).

</details>

#### Using `crane`

```bash
crane manifest <REGISTRY>/<REPO>:sha256-<HEX>.sig
```

#### Using `cosign`

```bash
cosign download signature <REGISTRY>/<REPO>@<DIGEST>
```

## Step 5: Relocate the signed bundle

When you copy the bundle to another registry, **copy the cosign signature objects too**. Without `--cosign-signatures`, the bundle arrives **unsigned** and the Supervisor treats it as untrusted.

```bash
imgpkg copy \
  -b <SOURCE_REGISTRY>/<REPO>@<DIGEST> \
  --to-repo <DEST_REGISTRY>/<REPO> \
  --cosign-signatures
```

Through a tarball (typical for moving across networks):

```bash
imgpkg copy -b <SOURCE_REGISTRY>/<REPO>@<DIGEST> --to-tar bundle-signed.tar --cosign-signatures
imgpkg copy --tar bundle-signed.tar --to-repo <DEST_REGISTRY>/<REPO> --cosign-signatures
```

Watch the progress lines for **`(cosign signature)`** — that confirms the signature layer was included in the copy.

After relocation, repeat the verification step against the destination registry to confirm the signature is present at the new location:

```bash
imgpkg describe -b <DEST_REGISTRY>/<REPO>@<DIGEST>
```

You should see a `Type: Signature` row tagged `sha256-<HEX>.sig` matching your bundle digest.

## Common pitfalls

- **Signing by tag instead of digest.** Tags are mutable; if the tag is later moved to point at a different bundle, the signature will not match what customers pull. Always sign and publish using `@sha256:<DIGEST>`.
- **Forgetting `--cosign-signatures` during relocation.** `imgpkg copy` does not transfer cosign signature objects unless this flag is passed. The bundle arrives at the destination registry intact but unsigned, and the Supervisor will treat it as untrusted.
- **Expired leaf certificate.** The Supervisor does not consult a trusted timestamp service; once the leaf certificate's `notAfter` has passed, verification fails even if the signature was valid when produced. Plan signing-cert rotation accordingly.
- **Custom CA not in the Supervisor trust pool.** The Supervisor accepts only signatures that chain to a root it already trusts. See [Trust and certificate chains](#trust-and-certificate-chains).

