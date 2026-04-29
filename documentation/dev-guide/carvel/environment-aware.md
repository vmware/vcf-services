# Building Environment-Aware Supervisor Services

When developing a Supervisor Service, your application often needs to know about the environment it's running in (e.g., "Does this Supervisor expose a particular platform capability?" or "How large are the control plane nodes?").

Developers can bind their declared Package inputs to well-known properties published in the **SupervisorProperties** custom resource. The Supervisor injects these values into your service at runtime and updates your deployed application when any of them change.

## Implementation: From Schema to Runtime

### Step A: Declare the Property

In your Package definition, add the specific keys to `valuesSchema`. The key names must match those exposed by the SupervisorProperties API (see the [Reference table](#reference-supported-properties) below). In this example we use `virtualIP` (the Virtual IP used to access the Supervisor API).

```yaml
apiVersion: data.packaging.carvel.dev/v1alpha1
kind: Package
metadata:
  name: my-service.example.com
  # namespace, etc.
spec:
  valuesSchema:
    openAPIv3:
      type: object
      additionalProperties: false
      properties:
        virtualIP:  # Supervisor injects the cluster Virtual IP here
          type: string
          description: "Virtual IP of the LoadBalancer fronting the Supervisor API."
          default: ""
```

- The property name in your `valuesSchema` must be exactly the SupervisorProperties spec key (case-sensitive). `virtualIP` works; `VirtualIP`, `virtualIp`, or a nested `apiserver.virtualIP` will not bind.
- If the Supervisor doesn't expose a property your Package declares (e.g. an older Supervisor), the binding is silently skipped and the schema's `default:` is used. That makes setting a sensible `default:` important for forward/backward compatibility.

### Step B: Consume the Property in your Workload

Once a property is declared in `valuesSchema`, the platform makes it available as `data.values.<propertyName>` to ytt at templating time. There are two correct patterns for getting that value into your running container, and the right choice depends on whether you own the workload manifest.

> **ytt syntax reminder.** Directives must start with `#@` followed by a space (for example, `#@ load("@ytt:data", "data")`). Without the space, ytt treats the line as a normal YAML comment and your template will not execute.

#### Pattern 1 — preferred: reference `data.values` directly in your Deployment source

If you author your own manifests, the cleanest pattern is to reference `data.values` inline in the Deployment. No overlay needed.

```yaml
#@ load("@ytt:data", "data")
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-controller
  namespace: #@ data.values.namespace
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: my-controller
  template:
    metadata:
      labels:
        app.kubernetes.io/name: my-controller
    spec:
      containers:
        - name: manager
          image: my-registry.example.com/my-controller:1.0.0
          env:
            - name: APISERVER_LB_VIRTUAL_IP
              value: #@ data.values.virtualIP
```

Notes:

- Because you declared `virtualIP` in `valuesSchema` with `default: ""`, `data.values.virtualIP` is always defined.
- ytt enforces that the runtime value matches the schema's declared type. If you declared `type: string`, `data.values.virtualIP` is already a string. For non-string properties (e.g. `controlPlaneCount: integer`), wrap with `str(...)` — see [Tips that apply to both patterns](#tips-that-apply-to-both-patterns) below.

#### Pattern 2 — overlay: inject the env var into a Deployment you don't own

Use this when the Deployment is rendered from upstream YAML (Helm output, a third-party operator manifest you don't want to fork, etc.) and you only want to add an env var on top.

```yaml
#@ load("@ytt:overlay", "overlay")
#@ load("@ytt:data", "data")

#@overlay/match by=overlay.subset({"kind": "Deployment", "metadata": {"name": "my-controller"}}), expects=1
---
spec:
  template:
    spec:
      containers:
        #@overlay/match by=overlay.subset({"name": "manager"})
        - name: manager
          #@overlay/match missing_ok=True
          env:
            #@overlay/append
            - name: APISERVER_LB_VIRTUAL_IP
              value: #@ data.values.virtualIP
```

Why each annotation matters:

- `#@overlay/match by=overlay.subset({"kind": "Deployment", "metadata": {"name": "my-controller"}})` — selects exactly one Deployment by kind + name. Replace `my-controller` with your Deployment's name.
- `#@overlay/match by=overlay.subset({"name": "manager"})` — selects the specific container by name. Without this, ytt would require you to match every container in the Pod.
- `#@overlay/match missing_ok=True` on `env:` — required because the source container may have no `env:` field at all.
- `#@overlay/append` on the env entry — **the critical bit.** Without `append`, ytt treats the array as a replacement and either errors out (if `env:` already exists with different entries) or silently overwrites the existing env vars. With `append`, the new entry is added alongside any existing ones.

If you want to inject the same env var into several containers (e.g. a sidecar pattern), match all containers and append into each one:

```yaml
        #@overlay/match by=overlay.all, expects="1+"
        -
          #@overlay/match missing_ok=True
          env:
            #@overlay/append
            - name: APISERVER_LB_VIRTUAL_IP
              value: #@ data.values.virtualIP
```

#### Tips that apply to both patterns

- **Type coercion.** A Pod env var's `value:` must be a string. For non-string properties:

  ```yaml
  # controlPlaneCount (integer)
  - name: CP_COUNT
    value: #@ str(data.values.controlPlaneCount)

  # podVMSupported (boolean) — lower() so you get "true"/"false"
  - name: POD_VM_SUPPORTED
    value: #@ str(data.values.podVMSupported).lower()
  ```

- **Object properties.** For complex properties like `controlPlaneResources` (`{cpuCount, memoryMiB}`), reference subfields:

  ```yaml
  - name: CP_CPU_COUNT
    value: #@ str(data.values.controlPlaneResources.cpuCount)
  - name: CP_MEMORY_MIB
    value: #@ str(data.values.controlPlaneResources.memoryMiB)
  ```

- **Array properties.** For `apiServerDNSNames` (array of string), join into a single string the consumer can parse:

  ```yaml
  - name: APISERVER_DNS_NAMES
    value: #@ ",".join(data.values.apiServerDNSNames)
  ```

- **Restart on change.** Env vars are read once at Pod start. The values Secret backing `data.values` is updated by the platform when SupervisorProperties changes, and `kapp-controller` will roll the Deployment so the new value takes effect. If you'd rather not restart on every change, mount the value via a `ConfigMap` / `Secret` instead and have your code re-read it.

## Reference: Supported Properties

The following properties are currently exposed by the API. If your service requires a property not listed here, it may require a newer version of the Supervisor.


| Property | Type | Description |
|----------|------|-------------|
| `apiServerDNSNames` | array of string | API server DNS names associated with the Supervisor. |
| `capabilities` | array of object | Capabilities the Supervisor has (e.g. vCenter-supported features). Each item has `name` (string) and `value` (boolean). |
| `controlPlaneCount` | integer | Number of control planes enabled on the Supervisor. |
| `controlPlaneResources` | object | Resource footprint of the control plane VM: `cpuCount` (integer), `memoryMiB` (integer). |
| `cpVMSize` | string | *Deprecated.* Use `controlPlaneResources` instead. Control plane size: `TINY`, `SMALL`, `MEDIUM`, or `LARGE`. |
| `namespacesCLIPluginVersion` | string | Supervisor-recommended namespaces CLIPlugin CR version. |
| `networkProvider` | string | Network provider used on the Supervisor (e.g. `NSX`, `nsx-vpc`, or `vsphere-network`). |
| `podVMSupported` | boolean | Whether the Supervisor supports vSphere Pods. |
| `ssoDomain` | string | Name of the default SSO domain configured in vCenter. |
| `stretchedSupervisor` | boolean | Whether the Supervisor is enabled on a set of vSphere Zones. |
| `supervisorUUID` | string | Instance ID of the Supervisor. |
| `vCenterTrustBundle` | string | Base64-encoded vCenter trusted root certificates in PEM format. |
| `vCenterUUID` | string | UUID of the vCenter. |
| `vcPNID` | string | Primary Network Identifier of vCenter. |
| `vcPort` | string | Port of vCenter. |
| `vcPublicKeys` | string | Base64-encoded vCenter OIDC issuer, client audience, and public keys in JWKS format. |
| `virtualIP` | string | IP address of the Kubernetes LoadBalancer type service fronting the API servers. |

