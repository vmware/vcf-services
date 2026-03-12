# Building Environment-Aware Supervisor Services

When developing a Supervisor Service, your application often needs to know about the environment it's running in (e.g., "Is the Supervisor's network backed by NSX or vSphere Networking?" or "How large are the control plane nodes?").

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

### Step B: Map the Property to an Env Var

Use a ytt overlay to inject that value into your container's environment. The Supervisor populates `data.values` with the keys you declared in the schema, so the overlay reads from `data.values` and sets an env var your app can use (e.g., `APISERVER_LB_VIRTUAL_IP`).

In the overlay, replace `my-controller` with your Deployment's `metadata.name` so the match targets the correct workload.

```yaml
#@ load("@ytt:overlay", "overlay")
#@ load("@ytt:data", "data")

#! Sets APISERVER_LB_VIRTUAL_IP from the Supervisor-injected virtualIP.
#! Note: Use "#@ data" (with a space); "#@data" is not valid ytt syntax.

#@ def get_virtual_ip(values):
#@   if hasattr(values, "virtualIP"):
#@     return values.virtualIP
#@   end
#@   return ""
#@ end

#@overlay/match by=overlay.subset({"kind": "Deployment", "metadata": {"name": "my-controller"}}), expects=1
---
spec:
  template:
    spec:
      containers:
        #@overlay/match by=overlay.all, expects="1+"
        -
          #@overlay/match missing_ok=True
          env:
            - name: 'APISERVER_LB_VIRTUAL_IP'
              value: #@ get_virtual_ip(data.values)
```

## Reference: Supported Properties

The following properties are currently exposed by the API. If your service requires a property not listed here, it may require a newer version of the Supervisor.


| Property | Type | Description |
|----------|------|-------------|
| `apiServerDNSNames` | array of string | API server DNS names associated with the Supervisor. |
| `capabilities` | array of object | Capabilities the Supervisor has (e.g. vCenter-supported features). Each item has `name` (string) and `value` (boolean). |
| `cloudVC` | boolean | Whether the vCenter is deployed on cloud. |
| `controlPlaneCount` | integer | Number of control planes enabled on the Supervisor. |
| `controlPlaneResources` | object | Resource footprint of the control plane VM: `cpuCount` (integer), `memoryMiB` (integer). |
| `cpVMSize` | string | *Deprecated.* Use `controlPlaneResources` instead. Control plane size: `TINY`, `SMALL`, `MEDIUM`, or `LARGE`. |
| `metricsHTTPRemoteEndpoint` | object | Config for the Supervisor to push workload metrics to an HTTP remote endpoint: `host` (required), `port`, `tlsClientSecretName`, `tlsClientSecretNamespace`. |
| `namespacesCLIPluginVersion` | string | Supervisor-recommended namespaces CLIPlugin CR version. |
| `networkProvider` | string | Network provider used on the Supervisor (e.g. `NSX`, `nsx-vpc`, or `vsphere-network`). |
| `podVMSupported` | boolean | Whether the Supervisor supports PodVMs. |
| `ssoDomain` | string | Name of the default SSO domain configured in vCenter. |
| `stretchedSupervisor` | boolean | Whether the Supervisor is enabled on a set of vSphere Zones. |
| `supervisorUUID` | string | Instance ID of the Supervisor. |
| `tmcNamespace` | string | Namespace used for TMC to be deployed. |
| `vCenterTrustBundle` | string | Base64-encoded vCenter trusted root certificates in PEM format. |
| `vCenterUUID` | string | UUID of the vCenter. |
| `vcPNID` | string | Primary Network Identifier of vCenter. |
| `vcPort` | string | Port of vCenter. |
| `vcPublicKeys` | string | Base64-encoded vCenter OIDC issuer, client audience, and public keys in JWKS format. |
| `virtualIP` | string | IP address of the Kubernetes LoadBalancer type service fronting the API servers. |
