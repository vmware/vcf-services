# Supporting Private Registries

Enterprise environments often mirror images into private or air-gapped registries that require authentication. If your Supervisor Service does not support authenticated image pulls, deployments will fail when customers relocate your bundle.

To support private registries, do not hardcode credentials. Instead, include a placeholder `Secret` in your package. At runtime, the Supervisor populates this `Secret` with the customer’s registry credentials, and your workloads reference it via `imagePullSecrets`. This follows the Carvel/kapp-controller [Placeholder Secret contract](https://carvel.dev/kapp-controller/docs/latest/private-registry-auth/#package-authoring-and-placeholder-secrets) and ensures secure, portable deployments across enterprise environments.

## 1. Create a Placeholder Secret

You must include a `Secret` in your package manifests with a specific annotation. This annotation tells the platform: "Please put the valid image pull credentials here."

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-service-registry-creds
  annotations:
    secretgen.carvel.dev/image-pull-secret: ""
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: e30K  # Base64 for "{}" (empty JSON object)
```

## 2. Bind the Secret to your Workloads

The placeholder secret is useless unless your Pods know to use it. You must reference this secret in the `imagePullSecrets` field of your Deployment, DaemonSet, or StatefulSet.

### Using ytt to Patch Workloads

A best practice is to use a ytt overlay so every workload in your package gets the secret reference. The example below matches `Deployment`; use the same `imagePullSecrets` block for other workload types (e.g. match on `kind: DaemonSet` or `kind: StatefulSet` as needed).

```yaml
#@ load("@ytt:overlay", "overlay")

#@overlay/match by=overlay.subset({"kind": "Deployment"}), expects="1+"
---
spec:
  template:
    spec:
      #@overlay/match missing_ok=True
      imagePullSecrets:
        - name: my-service-registry-creds
```

## 3. Verification & Testing

To verify your package is "Private Registry Ready" without a full corporate setup, follow these steps:

1. **Local Registry:** Run a local Docker registry with basic authentication enabled and config the Supervisor to trust this registry.
2. **Relocate:** Use `imgpkg copy` to move your bundle to your local private registry (e.g. `imgpkg copy -b <source> --to-repo <local-registry> --cosign-signatures`). *Do not use `push`; imgpkg preserves the image lockfile required for resolution. Include `--cosign-signatures` so that any signatures are copied along with the bundle.*
3. **Install:** Install the package on a Supervisor.
4. **Check Pods:** If your Pods reach Running status, the platform successfully populated your placeholder secret and the Kubelet used it to authenticate.

> **Caution:** If the imgpkg bundle pulls successfully but the Pods fail with Unauthorized, you likely forgot to add the `imagePullSecrets` reference in your Deployment spec.
