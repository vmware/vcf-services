# Building Environment-Aware Supervisor Services

When developing a Supervisor Service, your application often needs to know about the environment it's running in (e.g., "Is the network NSX or VDS?" or "How large are the control plane nodes?").

Instead of asking the user to provide this info, you can "bind" your service to **SupervisorProperties**. The Supervisor will then automatically inject these values into your service at runtime.

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
