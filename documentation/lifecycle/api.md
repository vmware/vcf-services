# VCF Service API

The VCF Service API provides full lifecycle management for VCF Services through RESTful endpoints. It covers creating, configuring, monitoring, and deleting services in VCF Automation.

> **Note:** This API covers service-level operations only (install, configure, activate, upgrade, delete). The individual Custom Resource types managed by the service engine are documented in the [Extensions](../extensions/element-types-overview.md) section.

## Base Path and Versioning

```text
Base path:    /api/extension/broadcom/service-manager/v2
API version:  2.0.0
Content-Type: application/json
Accept:       application/json;version=41.0.0-alpha
```

All path examples are relative to the base path. Examples use `<<vcfa_host>>` as a placeholder for your VCF Automation hostname.

---

## Authentication

All requests require a Bearer token obtained from the VCF Automation session endpoint.

### Obtain a token

```http request
POST https://<<vcfa_host>>/cloudapi/1.0.0/sessions/provider/
Accept: application/json;version=41.0.0-alpha
Authorization: Basic <base64(username:password)>
```

The response header `x-vmware-vcloud-access-token` contains the token. Tokens are valid for the duration of the session - cache them rather than requesting a new token per call.

### Use the token

```http request
GET https://<<vcfa_host>>/api/extension/broadcom/service-manager/v2/vcf-services?page=1&pageSize=25
Accept: application/json;version=41.0.0-alpha
Authorization: Bearer <access-token>
```

---

## Endpoints

### `POST /v2/vcf-services` - Create Service

Uploads and initialises a new VCF Service package. The service is created in `inactive` state by default.

#### Request body - `CreateServiceRequest`

```json
{
  "source": "https://depot.example.com:9443/arcturus-service-9.1.0.0.tar",
  "name": "arcturus.galaxy.com",
  "version": "9.1.0.0"
}
```

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `source` | string | **Yes** | URL to the service tarball. Pattern: `^(oci\|https)://.*\.tar$` |
| `name` | string | No | Service name; extracted from the package if omitted |
| `version` | string | No | Service version; extracted from the package if omitted |

#### Response - `200 OK` - `VcfService`

```json
{
  "id": "urn:vcloud:entity:broadcom:vcfService:ebb132a1-f849-4bb7-a516-eed6e691e83e",
  "vendor": "broadcom",
  "name": "arcturus.galaxy.com",
  "version": "9.1.0.0",
  "source": "https://depot.example.com:9443/arcturus-service-9.1.0.0.tar",
  "status": "Busy",
  "lifecycleState": "inactive",
  "values": {
    "platformOverlay": "",
    "vendorOverlay": "",
    "userOverwrite": "",
    "effective": ""
  },
  "accepted": {
    "eula": false,
    "signatures": false,
    "accessGrants": {}
  }
}
```

After creation the service `status` progresses through:

| Status | Meaning |
| :---- | :---- |
| `Busy` | Package download and extraction in progress |
| `Unresolved` | Package extracted; awaiting configuration |
| `Ready` | EULA, signatures, and access grants accepted; ready to activate |

Poll `GET /v2/vcf-services/{id}` to track progress.

---

### `GET /v2/vcf-services` - List Services

Returns a paginated list of VCF Services.

#### Query parameters

| Parameter | Type | Required | Default | Description |
| :---- | :---- | :---- | :---- | :---- |
| `page` | integer | **Yes** | 1 | Page to fetch (1-indexed, minimum 1) |
| `pageSize` | integer | **Yes** | 25 | Results per page (0–128) |
| `filter` | string | No | - | [FIQL](https://tools.ietf.org/html/draft-nottingham-atompub-fiql-00) filter expression |
| `sortAsc` | string | No | - | Field name for ascending sort |
| `sortDesc` | string | No | - | Field name for descending sort |
| `metadata` | boolean | No | - | Include `PackageMetadata` in the response |
| `package` | boolean | No | - | Include the Carvel `Package` definition in the response |
| `state` | boolean | No | - | Include current resource state and errors |
| `inventory` | boolean | No | - | Include inventory data |
| `signatures` | boolean | No | - | Include full signature details; when omitted only `isValid` and `validationTime` are returned |

#### FIQL filter examples

```text
lifecycleState==active
vendor==broadcom;status==Healthy
name==*arcturus*
```

#### Response - `200 OK` - `VcfServiceResultSet`

```json
{
  "resultTotal": 5,
  "pageCount": 1,
  "page": 1,
  "pageSize": 25,
  "values": [
    {
      "id": "urn:vcloud:entity:broadcom:vcfService:...",
      "vendor": "broadcom",
      "name": "arcturus.galaxy.com",
      "version": "9.1.0.0",
      "status": "Healthy",
      "lifecycleState": "active",
      "phase": "Installing",
      "labels": { "environment": "production" },
      "locations": { "region": "us-west-1" }
    }
  ]
}
```

Each item in `values` is a `VcfServiceWithExtras` object (see [Schemas](#schemas)).

---

### `GET /v2/vcf-services/{id}` - Get Service

Returns full information about a specific service.

#### Path parameters

| Parameter | Description |
| :---- | :---- |
| `id` | Service URN returned by Create Service |

#### Query parameters

Same optional flags as List Services: `metadata`, `package`, `state`, `inventory`, `signatures`.

#### Response - `200 OK` - `VcfServiceWithExtras`

See [Schemas - VcfServiceWithExtras](#vcfservicewithextras).

---

### `PUT /v2/vcf-services/{id}` - Update Service

Replaces the entire service representation. All required fields must be provided. Returns `202 Accepted`.

#### Query parameters

| Parameter | Type | Required | Default | Description |
| :---- | :---- | :---- | :---- | :---- |
| `signatures` | boolean | No | false | Include full signature details in the response |

#### Request body - `UpdateServiceRequest`

```json
{
  "id": "urn:vcloud:entity:broadcom:vcfService:...",
  "values": {
    "platformOverlay": "<base64-encoded-yaml>",
    "vendorOverlay": "",
    "userOverwrite": "cmVnaW9uczoKICAtIG5hbWU6IHVzLXdlc3QtMQo="
  },
  "lifecycleState": "active",
  "accepted": {
    "eula": true,
    "signatures": true,
    "accessGrants": {
      "VCF Automation": {
        "GlobalRole": ["Arcturus Administrator"],
        "VcfaServiceAccount": ["arcturus-service-account"]
      },
      "Supervisor": {
        "ManagementService": ["vcf-depot"]
      }
    }
  }
}
```

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `id` | string | **Yes** | Service URN |
| `values` | `Values` | **Yes** | Overlay values (see [Schemas - Values](#values)) |
| `lifecycleState` | string | **Yes** | `active`, `inactive`, `paused`, or `decommissioned` |
| `reconfigure` | `Reconfigure` | No | Reconfiguration event triggers |
| `accepted` | object | No | EULA, signature, and access grant acceptance |
| `source` | string | No | New tarball URL (triggers upgrade) |

> **Activation requirement:** To set `lifecycleState: active` you must provide `accepted.eula: true`, `accepted.signatures: true`, and `accepted.accessGrants` exactly matching the output of `POST /render-access-grants`.

---

### `PATCH /v2/vcf-services/{id}` - Partial Update

Partially updates a service. Only fields provided in the request body are modified. Returns `202 Accepted`.

#### Query parameters

| Parameter | Type | Required | Default | Description |
| :---- | :---- | :---- | :---- | :---- |
| `signatures` | boolean | No | false | Include full signature details in the response |

#### Request body - `PatchServiceRequest`

All fields are optional. Omitted fields are not changed.

| Field | Type | Description |
| :---- | :---- | :---- |
| `values` | `Values` | Overlay values (`platformOverlay`, `vendorOverlay`, `userOverwrite`) |
| `lifecycleState` | string | `active`, `inactive`, or `paused` |
| `phase` | string | `Installing`, `Resolving`, `Upgrading`, `Configuring`, `Uninstalling`, `Deleting`, `Editing`, `Publishing` |
| `labels` | `map[string]string` | Arbitrary key-value labels |
| `locations` | `map[string]string` | Key-value location descriptors (e.g. region, datacenter) |
| `accepted` | object | `eula`, `signatures`, `accessGrants` |
| `reconfigure` | `Reconfigure` | Reconfiguration event triggers |
| `source` | string | New tarball URL (triggers upgrade) |

> **Note:** `lifecycleState` cannot be set to `decommissioned` via PATCH. Use `DELETE` to initiate deletion.

#### Example: activate service

```json
{
  "lifecycleState": "active",
  "accepted": {
    "eula": true,
    "signatures": true,
    "accessGrants": {
      "VCF Automation": {
        "GlobalRole": ["Arcturus Administrator"],
        "VcfaServiceAccount": ["arcturus-service-account"]
      },
      "Supervisor": {
        "ManagementService": ["vcf-depot"]
      }
    }
  }
}
```

#### Example: update user configuration

```json
{
  "values": {
    "userOverwrite": "cmVnaW9uczoKICAtIG5hbWU6IHVzLXdlc3QtMQo="
  }
}
```

`userOverwrite` is a base64-encoded YAML string containing the overrides to apply on top of auto-generated values.

#### Example: add labels and locations

```json
{
  "labels": {
    "environment": "production",
    "team": "platform"
  },
  "locations": {
    "region": "us-west-1",
    "datacenter": "dc01"
  }
}
```

#### Example: trigger reconfiguration

```json
{
  "reconfigure": {
    "events": ["new-supervisor"]
  }
}
```

#### Example: upgrade to a new version

```json
{
  "source": "https://depot.example.com:9443/arcturus-service-9.2.0.0.tar"
}
```

See [Upgrade](upgrade.md) for the full upgrade workflow.

---

### `DELETE /v2/vcf-services/{id}` - Delete Service

Marks the service for deletion. The controller cleans up all Custom Resources (honouring finalizers) and then removes the service entity. Returns `202 Accepted`; deletion is asynchronous.

#### Query parameters

| Parameter | Type | Required | Default | Description |
| :---- | :---- | :---- | :---- | :---- |
| `forceDelete` | boolean | No | false | Proceed immediately with resource cleanup. |

---

### `GET /v2/vcf-services/{id}/state` - Get Service State

Returns the current status of every Custom Resource managed by the service plus any structured error details.

#### Response - `200 OK` - `State`

```json
{
  "resources": [
    {
      "type": "SupervisorService",
      "name": "sm-ebb132a1-...-5llfv",
      "namespace": "...",
      "status": "Healthy",
      "message": "Service running successfully",
      "lastModified": "2026-02-09T10:30:00Z"
    },
    {
      "type": "Overlay",
      "name": "sm-ebb132a1-...-jdfzf",
      "namespace": "...",
      "status": "Busy",
      "message": "Waiting for ready conditions: externalIp",
      "lastModified": "2026-02-09T10:31:00Z"
    }
  ],
  "errorDetails": [
    {
      "type": "CustomResource",
      "severity": "WARN",
      "message": "Overlay waiting for SupervisorService ready condition: externalIp not yet available"
    }
  ]
}
```

---

### `GET /v2/vcf-services/{id}/inventory` - Get Inventory

Returns the live inventory used for rendering service values.

#### Response - `200 OK` - `Inventory`

```json
{
  "regions": [
    {
      "name": "us-west-1",
      "supervisors": [
        {
          "name": "supervisor-vc1",
          "id": "domain-c8",
          "version": "9.0.1234",
          "defaultStorageClass": "vks-content-library",
          "vcenterName": "vcenter1.example.com",
          "vcenterId": "vc-uuid-123",
          "managementServices": {
            "vcf-depot": {
              "addresses": ["10.0.1.100"],
              "caChain": "-----BEGIN CERTIFICATE-----\n...",
              "ports": {
                "https": { "port": 443, "protocol": "TCP" }
              }
            }
          }
        }
      ],
      "storageClasses": ["platinum", "gold", "silver"]
    }
  ]
}
```

---

### `GET /v2/vcf-services/{id}/metadata` - Get Package Metadata

Returns the `PackageMetadata` from the service bundle as a JSON object (display name, description, icon, provider).

---

### `GET /v2/vcf-services/{id}/package` - Get Package Definition

Returns the Carvel `Package` CR YAML from the bundle, including the OpenAPI v3 values schema.

Response `Content-Type: application/yaml`.

---

### `POST /v2/vcf-services/{id}/render-effective-values` - Render Effective Values

Renders the final merged YAML values that would be used for installation after applying all overlay layers. Use this to preview and validate configuration before activation or update.

#### Query parameters

| Parameter | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `expanded` | boolean | No | Include schema default values in the output |

#### Request body - `Values`

```json
{
  "inventory": {
    "regions": [
      {
        "name": "us-west-1",
        "supervisors": [
          {
            "name": "supervisor-vc1",
            "id": "domain-c8",
            "version": "9.0.1234",
            "defaultStorageClass": "vks-content-library",
            "vcenterName": "vcenter1.example.com",
            "vcenterId": "vc-uuid-123"
          }
        ],
        "storageClasses": ["platinum", "gold"]
      }
    ]
  },
  "platformOverlay": "<base64-encoded-yaml>",
  "vendorOverlay": "",
  "userOverwrite": "<base64-encoded-yaml>"
}
```

All overlay fields are base64-encoded YAML strings. Use the inventory from `GET /inventory` for accurate rendering.

#### Response - `200 OK` - `application/yaml`

Returns rendered YAML with all overlays applied, e.g.:

```yaml
defaults:
  arcturusAdminPassword: Arcturus12345
regions:
  - name: us-west-1
    hostSupervisor:
      name: supervisor-vc1
      configuration:
        persistence:
          persistentVolumeClaim:
            registry:
              storageClass: vks-content-library
              size: 10Gi
```

---

### `POST /v2/vcf-services/{id}/render-resources` - Render Resources

Renders the Kubernetes Custom Resources that will be created when the service is activated. Use this to preview exactly which CRs the Service Manager will apply.

#### Request body - `Values`

Same structure as `render-effective-values`.

#### Response - `200 OK` - `application/yaml`

Returns the rendered CR manifests as YAML.

---

### `POST /v2/vcf-services/{id}/render-access-grants` - Render Access Grants

Returns the access grants required by the service. The object returned by this endpoint must be used verbatim as `accepted.accessGrants` in any PUT or PATCH request that activates the service.

#### Request body - `Values`

Same structure as `render-effective-values`.

#### Response - `200 OK` - `AccessGrants`

```json
{
  "vCenter": {
    "Role": ["Arcturus vCenter Administrator"]
  },
  "VCF Automation": {
    "GlobalRole": ["Arcturus Administrator"],
    "Role": ["Arcturus Service Agent"],
    "RightBundle": ["arcturusRightsBundle"],
    "RelyingParty": ["https://arcturus.example.com/callback"],
    "VcfaServiceAccount": ["arcturus-service-account"],
    "ApiExtensionProxy": ["ArcturusUIProxy"]
  },
  "Supervisor": {
    "ManagementService": ["vcf-depot"]
  }
}
```

---

## Schemas

### `VcfService`

Core service object returned by create and embedded in all other responses.

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `id` | string | Yes | Service URN (`urn:vcloud:entity:broadcom:vcfService:<uuid>`) |
| `vendor` | string | Yes | Service vendor name |
| `name` | string | Yes | Service package name |
| `version` | string | Yes | Service package version |
| `source` | string | Yes | Tarball URL; pattern `^(oci\|http)://.*\.tar$` |
| `values` | `OverlayValues` | Yes | Current overlay values |
| `accepted` | object | Yes | EULA, signature, and access grant acceptance state |
| `status` | string | Yes | See [Status values](#status-values) |
| `lifecycleState` | string | Yes | See [Lifecycle states](#lifecycle-states) |
| `reconfigure` | `Reconfigure` | No | Last reconfiguration trigger |

### `VcfServiceWithExtras`

Extends `VcfService` with optional fields included when the corresponding query parameter is set.

| Field | Type | Included when |
| :---- | :---- | :---- |
| `metadata` | object | `?metadata=true` |
| `packageData` | string (base64 YAML) | `?package=true` |
| `state` | `State` | `?state=true` |
| `inventory` | `Inventory` | `?inventory=true` |
| `phase` | string | Always present |
| `labels` | `map[string]string` | Always present |
| `locations` | `map[string]string` | Always present |
| `tenants` | `map[string]string` | Always present |

### Lifecycle states

| Value | Description |
| :---- | :---- |
| `inactive` | Service registered but not running (default after creation). CRs are not applied. |
| `active` | Service running; controllers reconcile its CRs against target systems |
| `paused` | Reconciliation suspended; controllers skip processing |
| `decommissioned` | Deletion triggered; cleanup in progress (terminal - set via DELETE) |

### Status values

| Value | Description |
| :---- | :---- |
| `Ready` | Package extracted; EULA, signatures, and access grants accepted; ready to activate |
| `Unresolved` | Package extracted; awaiting configuration or acceptance |
| `Healthy` | All CRs operating normally |
| `Busy` | Operation in progress (download, install, reconcile, upgrade) |
| `Unhealthy` | One or more CRs in error state; inspect `state.errorDetails` |
| `Maintenance` | Upgrade in progress; service temporarily suspended |
| `Unavailable` | Service cannot be reached or managed |

### Phase values

`phase` tracks the current operational stage of the service:

| Value | Description |
| :---- | :---- |
| `Installing` | Initial installation in progress |
| `Resolving` | Resolving configuration and dependencies |
| `Upgrading` | Upgrade to a new version in progress |
| `Configuring` | Configuration handler executing |
| `Uninstalling` | Service being deactivated |
| `Deleting` | Service and all resources being deleted |
| `Editing` | Configuration update in progress |
| `Publishing` | Service being published to tenants |

### `OverlayValues`

| Field | Type | Description |
| :---- | :---- | :---- |
| `platformOverlay` | string | Base64-encoded YAML - provider scoping filter |
| `vendorOverlay` | string | Base64-encoded YAML - vendor transpiler output |
| `userOverwrite` | string | Base64-encoded YAML - operator manual overrides |
| `effective` | string | Base64-encoded YAML - final merged result (read-only) |

### `Values`

Request schema for all rendering endpoints and used as the `values` field in `UpdateServiceRequest`.

| Field | Type | Description |
| :---- | :---- | :---- |
| `inventory` | `Inventory` | Live infrastructure snapshot |
| `platformOverlay` | string | Base64-encoded YAML |
| `vendorOverlay` | string | Base64-encoded YAML |
| `userOverwrite` | string | Base64-encoded YAML |
| `effective` | string | Base64-encoded YAML |

### `Inventory`

Describes the live infrastructure available for the service.

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `regions[].name` | string | Yes | Region name |
| `regions[].supervisors` | array | Yes | Supervisor clusters in this region |
| `regions[].supervisors[].name` | string | Yes | Supervisor name |
| `regions[].supervisors[].id` | string | Yes | Supervisor ID (e.g. `domain-c8`) |
| `regions[].supervisors[].version` | string | Yes | Supervisor version string |
| `regions[].supervisors[].defaultStorageClass` | string | Yes | Default storage class |
| `regions[].supervisors[].vcenterName` | string | Yes | vCenter hostname |
| `regions[].supervisors[].vcenterId` | string | No | vCenter unique ID |
| `regions[].supervisors[].managementServices` | object | No | Map of management service name → endpoints |
| `regions[].storageClasses` | array | Yes | Available storage classes in the region |

### `AccessGrants`

Describes the system-level permissions a service requires. Must be accepted verbatim to activate a service.

| Field | Type | Description |
| :---- | :---- | :---- |
| `vCenter.Role` | string[] | vCenter roles |
| `VCF Automation.GlobalRole` | string[] | Provider-scoped RBAC roles |
| `VCF Automation.Role` | string[] | Tenant-scoped RBAC roles |
| `VCF Automation.RightBundle` | string[] | Custom right bundles |
| `VCF Automation.RelyingParty` | string[] | OAuth relying party redirect URIs |
| `VCF Automation.VcfaServiceAccount` | string[] | VCF Automation service accounts |
| `VCF Automation.ApiExtensionProxy` | string[] | API extension proxy endpoints |
| `Supervisor.ManagementService` | string[] | Supervisor management services (e.g. `vcf-depot`) |

### `Reconfigure`

| Field | Type | Description |
| :---- | :---- | :---- |
| `events` | string[] | Reconfiguration trigger events. Supported value: `new-supervisor` |

### `State`

| Field | Type | Description |
| :---- | :---- | :---- |
| `resources` | `ResourceInfo[]` | Current status of each managed Custom Resource |
| `errorDetails` | `ErrorDetail[]` | Structured error information |

### `ResourceInfo`

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `type` | string | Yes | CR kind (e.g. `SupervisorService`, `Overlay`) |
| `name` | string | Yes | CR name assigned by the Service Manager |
| `namespace` | string | Yes | Kubernetes namespace of the CR |
| `status` | string | Yes | CR status (`Healthy`, `Busy`, `Unhealthy`, `Maintenance`) |
| `message` | string | No | Human-readable status message |
| `lastModified` | string | Yes | RFC3339 timestamp of last status change |
| `resourceYaml` | string | No | Full CR YAML for debugging |

### `ErrorDetail`

| Field | Type | Required | Description |
| :---- | :---- | :---- | :---- |
| `type` | string | Yes | `DownloadTask`, `InstallTask`, `ConfigurationTask`, or `CustomResource` |
| `severity` | string | Yes | `ERROR`, `WARN`, or `INFO` |
| `message` | string | Yes | Detailed error description |

---

## Workflow Examples

### Install and activate a service

```shell
#!/usr/bin/env bash
set -euo pipefail

VCFA_HOST="vcfa.example.com"
API="https://${VCFA_HOST}/api/extension/broadcom/service-manager/v2"
ACCEPT="application/json;version=41.0.0-alpha"
SERVICE_TAR="https://depot.example.com:9443/arcturus-9.1.0.0.tar"

# 1. Obtain access token
TOKEN=$(curl -s -X POST \
  "https://${VCFA_HOST}/cloudapi/1.0.0/sessions/provider/" \
  -H "Accept: ${ACCEPT}" \
  -H "Authorization: Basic $(echo -n 'admin@system:Galaxy1!' | base64)" \
  -D - -o /dev/null \
  | grep -i 'x-vmware-vcloud-access-token' | awk '{print $2}' | tr -d '\r')

# 2. Create service
SERVICE_ID=$(curl -s -X POST "${API}/vcf-services" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"${SERVICE_TAR}\"}" | jq -r '.id')
echo "Created: ${SERVICE_ID}"

# 3. Wait until status is Ready
until [ "$(curl -s "${API}/vcf-services/${SERVICE_ID}" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}" \
  | jq -r '.status')" = "Ready" ]; do
  echo "Waiting for Ready..."; sleep 10
done

# 4. Get live inventory
INVENTORY=$(curl -s "${API}/vcf-services/${SERVICE_ID}/inventory" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}")

# 5. Render access grants (must be accepted verbatim)
ACCESS_GRANTS=$(curl -s -X POST \
  "${API}/vcf-services/${SERVICE_ID}/render-access-grants" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"inventory\": ${INVENTORY}}")

# 6. Activate service
curl -s -X PATCH "${API}/vcf-services/${SERVICE_ID}" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"lifecycleState\": \"active\",
    \"accepted\": {
      \"eula\": true,
      \"signatures\": true,
      \"accessGrants\": ${ACCESS_GRANTS}
    }
  }"

# 7. Monitor until Healthy
until [ "$(curl -s "${API}/vcf-services/${SERVICE_ID}" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}" \
  | jq -r '.status')" = "Healthy" ]; do
  echo "Installing..."; sleep 30
done
echo "Service active and healthy."
```

### Update user configuration

```shell
# Encode new values as base64 YAML
NEW_CONFIG=$(base64 <<'EOF'
regions:
  - name: us-west-1
    hostSupervisor:
      name: supervisor-vc1
      configuration:
        persistence:
          persistentVolumeClaim:
            registry:
              size: 20Gi
EOF
)

curl -s -X PATCH "${API}/vcf-services/${SERVICE_ID}" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"values\": {\"userOverwrite\": \"${NEW_CONFIG}\"}}"
```

### Preview configuration before applying

```shell
INVENTORY=$(curl -s "${API}/vcf-services/${SERVICE_ID}/inventory" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}")

# Render effective values (returns YAML)
curl -s -X POST "${API}/vcf-services/${SERVICE_ID}/render-effective-values" \
  -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"inventory\": ${INVENTORY}, \"userOverwrite\": \"${NEW_CONFIG}\"}"
```

---

## Error Reference

### HTTP status codes

| Code | Meaning | Common causes |
| :---- | :---- | :---- |
| `400 Bad Request` | Invalid request | Missing required fields, EULA not accepted, invalid lifecycle transition |
| `404 Not Found` | Service not found | Incorrect or expired service ID |
| `500 Internal Server Error` | Server error | Internal processing failure; retry with exponential backoff |

### Service status error states

| Status | Description | Resolution |
| :---- | :---- | :---- |
| `Unhealthy` | One or more CRs in error | Inspect `GET /state` - check `errorDetails` |
| `Busy` | Operation in progress | Wait; resolves automatically |
| `Unresolved` | Configuration incomplete | Accept EULA, signatures, and access grants, then activate |
| `Maintenance` | Upgrade in progress | Wait for upgrade to complete (see [Upgrade](upgrade.md)) |
| `Unavailable` | Service unreachable | Check Service Manager health and connectivity |

---

## Best Practices

- Use `PATCH` instead of `PUT` for routine updates to avoid accidentally clearing fields.
- Always use the access grants object returned by `POST /render-access-grants` without modification - any deviation prevents activation.
- Preview configuration with `POST /render-effective-values` before activating or updating.
- Specify only the query parameters you need (`state`, `metadata`, etc.) - omitting them reduces response size and latency.
- Cache access tokens for the duration of your automation run; do not request a new token per API call.
- Implement retry logic with exponential backoff for `Busy` states and transient 5xx errors.
- Use `labels` and `locations` to organise services for efficient FIQL filtering in large deployments.

## Related Documents

- [VCF Service Overview](vcf-service-overview.md) - lifecycle states and service architecture
- [Upgrade](upgrade.md) - upgrade, rollback, and deletion workflows
- [Packaging and Build](packaging-and-build.md) - how to build the service tarball supplied to `source`
- [Extensions Overview](../extensions/element-types-overview.md) - Custom Resource types managed by the service engine
