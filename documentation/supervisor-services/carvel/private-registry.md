# Supporting Private Registries

Enterprise environments often mirror images into private or air-gapped registries that require authentication. If your Supervisor Service does not support authenticated image pulls, deployments will fail when customers relocate your bundle.

To support private registries, do not hardcode credentials. Instead, ship an empty placeholder `Secret` in your package and let the platform fill it in. At install time, `secretgen-controller` (a Carvel component running on the Supervisor) populates the Secret's `.dockerconfigjson` payload. Your workloads then pull images via that Secret. This follows the Carvel/kapp-controller [Placeholder Secret contract](https://carvel.dev/kapp-controller/docs/latest/private-registry-auth/#package-authoring-and-placeholder-secrets) and ensures secure, portable deployments across enterprise environments.


## 1. Create a Placeholder Secret

Include a `Secret` of type `kubernetes.io/dockerconfigjson` in your package manifests, annotated with `secretgen.carvel.dev/image-pull-secret`. The annotation marks the Secret as a placeholder: `secretgen-controller` watches for this annotation and overwrites the empty payload with the actual registry credentials at install time.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-service-registry-creds
  annotations:
    # Tells secretgen-controller to populate this Secret with the
    # configured image-pull credentials at install time.
    secretgen.carvel.dev/image-pull-secret: ""
type: kubernetes.io/dockerconfigjson
data:
  # Base64 of "{}" — an empty docker config. The real value is overwritten
  # by secretgen-controller; the placeholder just has to be valid base64
  # of a syntactically valid (even if empty) JSON object.
  .dockerconfigjson: e30=
```

## 2. Bind the Secret to your Workloads

The placeholder secret is useless unless your Pods are pulling their container images using it. There are two ways to wire it up.

### Option A (recommended): attach `imagePullSecrets` to the ServiceAccount

If your workloads run as a dedicated `ServiceAccount` (which they should), declare `imagePullSecrets` on the `ServiceAccount` itself. Kubernetes then automatically injects the reference into every Pod that uses that `ServiceAccount` — including Pods you didn't write yourself (e.g. Jobs created by an Operator at runtime).

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-service
  # The Pod templates of every Deployment/DaemonSet/StatefulSet/Job/etc.
  # that uses serviceAccountName: my-service will inherit this list.
imagePullSecrets:
  # Must match the metadata.name of the placeholder Secret in section 1.
  - name: my-service-registry-creds
```

This avoids the overlay-per-workload-kind problem in Option B and is an approach that automatically covers Pods created dynamically by your controllers.

### Option B: patch every workload via a ytt overlay

If your workloads use the namespace's `default` ServiceAccount, or you cannot edit the ServiceAccount manifest, set `imagePullSecrets` on each Pod-spawning resource. Pod-spawning resources include `Deployment`, `DaemonSet`, `StatefulSet`, `Job`, `CronJob`, `ReplicaSet`, and bare `Pod`.

The example below matches `Deployment`. You must repeat the overlay (or broaden the match) for every other workload kind your package ships, otherwise those Pods will silently fail with `ImagePullBackOff` once the bundle is relocated.

```yaml
#@ load("@ytt:overlay", "overlay")

#! Repeat this stanza (changing kind:) for DaemonSet, StatefulSet, Job, CronJob, etc.
#@overlay/match by=overlay.subset({"kind": "Deployment"}), expects="1+"
---
spec:
  template:
    spec:
      #! `missing_ok=True` lets the overlay add `imagePullSecrets` even when
      #! the original manifest does not declare it.
      #@overlay/match missing_ok=True
      imagePullSecrets:
        #! Must match the metadata.name of the placeholder Secret created above.
        - name: my-service-registry-creds
```

## 3. Relocate a bundle to a private registry

The walkthrough below uses the `imgpkg` bundle that backs the Contour Supervisor Service as a worked example. Use it as a reference when validating that `imgpkg copy` pulls **all** referenced images and that `--cosign-signatures` is included when your bundle is signed.

### Prerequisites

- A private container image registry you can push to.
- [Carvel `imgpkg`](https://carvel.dev/imgpkg/) installed (see the [imgpkg install instructions](https://carvel.dev/imgpkg/docs/latest/install/)).

### Step 1: Locate the bundle in the Package

From your Supervisor Service YAML, read the `imgpkgBundle.image` under `template.spec.fetch`. Contour bundle is used as an example:

```yaml
template:
  spec:
    fetch:
    - imgpkgBundle:
        image: projects.registry.vmware.com/tkg/packages/standard/contour:v1.24.4_vmware.1-tkg.1
```

### Step 2: Download the bundle to a tarball

Use **`imgpkg copy`** (not `push` / `pull` alone) so every referenced layer is captured:

```bash
imgpkg copy -b projects.registry.vmware.com/tkg/packages/standard/contour:v1.24.4_vmware.1-tkg.1 \
  --to-tar contour-v1.24.4.tar \
  --cosign-signatures
```

**Example output** (line wrapping and digest lines vary by run; the important part is **`Succeeded`** at the end):

```text
copy | exporting 8 images...
copy | will export projects.registry.vmware.com/tkg/packages/standard/contour@sha256:...
copy | exported 8 images
copy | importing 8 images...
copy | importing projects.registry.vmware.com/tkg/packages/standard/contour@sha256:... -> /tmp/...
...
copy | done uploading images
Succeeded
```

> **Why `copy`:** `push` and `pull` by themselves do not pull down all referenced images the way `copy` does when relocating a thick bundle. See the [Carvel `imgpkg` copy guide](https://carvel.dev/imgpkg/docs/latest/commands/#copy) for details.

### Step 3: Upload the tarball to your private registry and verify Pod status

Set `REGISTRY_URL` to your registry host (no `https://` prefix in the repo path). Authenticate first if the registry requires login — `imgpkg` honors Docker-style credentials for many setups (`docker login`); if credential helpers cause issues, use `--registry-username` / `--registry-password` or `IMGPKG_USERNAME` / `IMGPKG_PASSWORD` on `imgpkg copy` instead.

```bash
docker login "${REGISTRY_URL}"

imgpkg copy --tar contour-v1.24.4.tar \
  --to-repo "${REGISTRY_URL}/contour" \
  --cosign-signatures
```

**Example output** (abbreviated):

```text
copy | importing 8 images...
copy | done uploading images
Succeeded
```

> **`--cosign-signatures`:** include it whenever the source bundle (or its signature objects) was signed; omitting it drops signatures and the Supervisor may treat the bundle as untrusted. See [Image Signing and Verification](../security/image-signing.md).

### Step 4: Point the Package at the new bundle location

After the upload, update your `Package` (or the manifest you publish to customers) so `imgpkgBundle.image` references the same **tag** (or digest) under your private registry:

```yaml
template:
  spec:
    fetch:
    - imgpkgBundle:
        image: n.n.n.n/contour:v1.24.4_vmware.1-tkg.1
```

Replace `n.n.n.n` with your registry hostname and adjust the path to match what you passed to `--to-repo`.

## 4. Register and install on a Supervisor

Register the service with vCenter and install it on a Supervisor (UI, `kubectl`, or API) using the **private** `imgpkgBundle.image` URL. Ensure registry credentials for that service are configured in vCenter so `secretgen-controller` can populate your placeholder Secret.

## 5. Verify workloads

If Pods reach `Running`, the kubelet successfully pulled images (using the populated Secret if your workload references it).

```bash
# Supervisor kubeconfig (example): kubectl vsphere login --server=<supervisor> ...
# Service namespace is allocated by the platform; discover it then:
kubectl -n <service-namespace> get pods
```

## Troubleshooting

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| `imgpkg` bundle pulls successfully but Pods fail with `ImagePullBackOff` / `Unauthorized` | The Pod spec has no `imagePullSecrets` referencing the placeholder Secret. Common reasons: (a) the ytt overlay matched only `Deployment` and missed a `Job`/`DaemonSet`/etc., or (b) the workload uses a non-default `ServiceAccount` to which `imagePullSecrets` was never attached. | `kubectl -n <ns> get pod <p> -o jsonpath='{.spec.imagePullSecrets}'` to confirm the reference is actually on the Pod. If empty, render the bundle locally with `ytt` and grep for `imagePullSecrets` to see which kinds the overlay covered. Consider switching to the [ServiceAccount approach](#option-a-recommended-attach-imagepullsecrets-to-the-serviceaccount). |
| Pods fail with `ErrImagePull` even though the Pod spec references the secret | The placeholder Secret was not populated by `secretgen-controller`, or the populated Secret lives in a different namespace from the Pod. | Verify the populated payload: `kubectl -n <ns> get secret my-service-registry-creds -o jsonpath='{.data.\.dockerconfigjson}' \| base64 -d` (should be a real Docker config, not `{}`). If it is still empty, check (1) the `secretgen-controller` Pod logs in the `secretgen-controller` namespace, (2) that a `SecretExport` exists for the source credential in the system namespace, and (3) that the placeholder Secret is in the **same** namespace as the Pod — Secrets in `ns-foo` cannot be used by a Pod in `ns-bar`. |
| `imgpkg copy` itself fails with `UNAUTHORIZED` | The CLI is not authenticated to the destination registry, or `imgpkg` is not consuming Docker's credential helper (common on macOS with `docker-credential-osxkeychain`). | Use `--registry-username` / `--registry-password` directly on `imgpkg copy`, or set `IMGPKG_USERNAME` / `IMGPKG_PASSWORD`. Avoid relying on `docker login` alone in those environments. |
| Bundle pulled but image references still point at the source registry | Either the bundle was built without a `.imgpkg/images.yml` lockfile, or your Package's `template` step does not include `kbld` to rewrite refs at deploy time. Building with `kbld` once at author time is **not** sufficient. | Confirm the bundle contains `.imgpkg/images.yml` (run `imgpkg pull -b … -o /tmp/bundle && ls /tmp/bundle/.imgpkg`). In your Package's `template:` block, ensure there is a `kbld` step that consumes both your manifests and the lockfile, e.g. `kbld: { paths: ["-", ".imgpkg/images.yml"] }`. |
| Pods relocated cleanly but your Operator still pulls from the original registry | Image references stored outside Pod specs (e.g. in a `ConfigMap`, a CR, a Helm-style values file) are **not** rewritten by `kbld`. | Either feed those references through `kbld` at build time (so the relocated digests appear in the manifest before it ships in the bundle), or templatize them so the install-time values point at the relocated registry. |


## References

- [Deploying Supervisor Services from a Private Container Image Registry](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere-supervisor/8-0/vsphere-supervisor-services-and-workloads-8-0/deploying-supervisor-services-from-a-private-container-image-registry.html)

