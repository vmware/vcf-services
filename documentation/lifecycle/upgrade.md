# Upgrade, Rollback, and Deletion

This document covers the complete post-installation lifecycle of a VCF Service: how services progress through states, how upgrades work across all methods, how rollback is handled when an upgrade fails, and how deletion and force-deletion behave.

## Service Lifecycle States

A VCF Service always exists in one of four lifecycle states:

| State | Description | Allowed transitions |
| :---- | :---- | :---- |
| `inactive` | Service registered but not running; default after creation | → `active`, → `decommissioned` |
| `active` | Service running; controllers reconcile its Custom Resources | → `inactive`, → `paused`, → `decommissioned` |
| `paused` | Reconciliation temporarily suspended | → `active`, → `decommissioned` |
| `decommissioned` | Deletion triggered; cleanup in progress | (terminal) |

```text
Created (POST /vcf-services)
    │
    ▼
inactive ◄────────────────── PATCH lifecycleState: inactive ──────┐
    │                                                               │
    │  Accept EULA, signatures, access grants                       │
    │  PATCH lifecycleState: active                                 │
    ▼                                                               │
active ──────────────────────────────────────────────────────────►─┘
    │
    ├─ PATCH lifecycleState: paused ──► paused
    │                                     │
    │                                     └─ PATCH: active ──► active
    │
    └─ DELETE ──► decommissioned ──► deleted
```

### Managing State via API

```http request
PATCH /v2/vcf-services/{id}
Content-Type: application/json

{ "lifecycleState": "active",
  "accepted": { "eula": true, "signatures": true, "accessGrants": {...} } }
```

```http request
PATCH /v2/vcf-services/{id}
Content-Type: application/json

{ "lifecycleState": "paused" }
```

```http request
PATCH /v2/vcf-services/{id}
Content-Type: application/json

{ "lifecycleState": "inactive" }
```

```http request
DELETE /v2/vcf-services/{id}
```

---

## Installation Flow

When a service is first activated the following sequence runs:

```text
1. Service created (POST)                 Status: Busy
   └─► Package downloaded and extracted   Status: Unresolved

2. Administrator accepts EULA, signatures, access grants
   └─► PATCH lifecycleState: active

3. Service Manager renders Custom Resources
   └─► Inventory → Platform Overlay → Vendor Transpiler
       → User Overwrite → ytt → Effective Values

4. Custom Resources applied
   └─► Controllers take over reconciliation

5. Resource reconciliation
   ├─► New resources created on target systems
   └─► Existing resources adopted (ownership declared)

6. Service Healthy
   └─► All CRs Healthy; ready conditions satisfied
```

### Installation Value Layers

```text
┌─────────────────────────────────────────────────────────┐
│ 1. Inventory  (regions, supervisors, storage classes)   │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Platform Overlay  (provider scoping filter)          │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Vendor Transpiler  (inventory → service values)      │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. User Overwrite  (manual overrides)                   │
└────────────────────────┬────────────────────────────────┘
                         │ ytt
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Effective Values  (used for CR generation)           │
└─────────────────────────────────────────────────────────┘
```

### Resource Adoption

The Service Manager supports two paths when creating resources:

- **Create new** - resource does not exist on the target; it is created and ownership is declared.
- **Adopt existing** - a compatible resource already exists; the Service Manager declares ownership, reconciles any configuration drift, and manages it going forward.

Adoption is used when onboarding existing Supervisor Services, UI Plugins, or RBAC roles that were configured outside of VCF Services.

---

## Compatibility Checks

Before a service version becomes available for installation or upgrade, compatibility is validated at two points:

### Static checks (at registration time)

**External** services:
- Resource definitions validated against supported CRD versions
- API version compatibility verified
- Schema validated against OpenAPI v3

**Built-in** services are compatible by default (validated through the VCF Automation release pipeline).

### Dynamic checks (at activation time)

Resources are staged on each target system and pre-checks are executed:

| Resource type | Additional checks |
| :---- | :---- |
| `SupervisorService` | Package manifest, image availability, resource quota |
| `UserInterfacePlugin` | Binary compatibility, plugin manifest, VCF Automation version |
| All others | Schema and API compatibility |

Pre-check results are aggregated per resource and surfaced in the service state:

```json
{
  "preCheckStatus": "Failed",
  "resourceChecks": [
    {
      "type": "UserInterfacePlugin",
      "name": "arcturus-ui",
      "status": "Failed",
      "checks": [
        {
          "name": "PluginCompatibility",
          "status": "Failed",
          "message": "Plugin requires VCF Automation 9.2+, current version: 9.1"
        }
      ]
    }
  ]
}
```

---

## Upgrade

### Core Upgrade Flow

Upgrading a service replaces its bundle with a new version while preserving configuration and minimising downtime. The current version enters maintenance mode for the duration.

```text
1. Upgrade initiated
   └─► PATCH source: <new-tarball-url>  or  automatic detection

2. Configuration extracted from current version
   └─► Validated against new version schema

3. Current version → Maintenance Mode
   └─► Status: Maintenance, Phase: Upgrading
   └─► Controllers skip reconciliation for existing resources
   └─► State frozen (no new changes applied)

4. New version installation
   └─► Same flow as first-time install
   └─► Uses inherited configuration

5. Resource handling
   ├─► New resources         → Created
   ├─► Removed resources     → Decommissioned
   ├─► Reconfigured resources → Ownership transferred to new version
   └─► Unchanged resources   → Ownership transferred to new version

6. Ownership transfer
   └─► Finalizers updated to new version

7. Current version cleanup
   └─► Finalizers removed, targets cleaned up
   └─► Version entity deleted

8. Upgrade complete
   └─► New version active and Healthy
```

### Resource Handling During Upgrade

| Resource type | Action | Ownership | Finalizers |
| :---- | :---- | :---- | :---- |
| New resources | Created immediately | New version | Added |
| Removed resources | Decommissioned | Current version | Removed before deletion |
| Reconfigured resources | Adopted by new version | Transferred | Updated |
| Unchanged resources | Adopted by new version | Transferred | Updated |

### Maintenance Mode

While the current version is in maintenance mode:

- Controllers skip all reconciliation for its resources.
- No changes are applied to target systems.
- The service reports `status: Maintenance`, `phase: Upgrading`.
- Maintenance mode ends when the current version is cleaned up after a successful upgrade, or when rollback is initiated after a failure.

### Upgrade Methods

#### Upgrade via UI

1. Service card shows **Upgrade Available**.
2. Operator clicks **Upgrade to \<version\>**.
3. UI loads current configuration and renders it against the new version's schema.
4. Operator reviews and adjusts parameters.
5. Operator confirms; upgrade proceeds with a progress indicator.
6. Rollback option is available if the upgrade fails.

#### Upgrade via API

Supply either the imgpkg bundle tarball URL (for offline / air-gapped upgrades) or the OCI bundle image URL in the `source` field:

```http request
PATCH /v2/vcf-services/{id}
Content-Type: application/json

{ "source": "https://depot.example.com/arcturus-9.2.0.0.tar" }
```

Monitor progress:

```http request
GET /v2/vcf-services/{id}?state=true
```

Watch `phase` (`Upgrading`) and `status` (`Maintenance` → `Healthy`). A shell polling loop:

```shell
while true; do
  RESP=$(curl -s "${API}/vcf-services/${SERVICE_ID}?state=true" \
    -H "Accept: ${ACCEPT}" -H "Authorization: Bearer ${TOKEN}")
  PHASE=$(echo "${RESP}" | jq -r '.phase')
  STATUS=$(echo "${RESP}" | jq -r '.status')
  echo "Phase: ${PHASE}  Status: ${STATUS}"

  if [ "${STATUS}" = "Healthy" ]; then
    echo "Upgrade complete."; break
  elif [ "${STATUS}" = "Unhealthy" ]; then
    echo "Upgrade failed. Check state.errorDetails."; exit 1
  fi
  sleep 30
done
```

---

## Rollback

If a new version fails to install, the previous version can be restored.

### Rollback Flow

```text
1. Upgrade fails
   └─► New version: Status Unhealthy

2. Rollback initiated
   └─► POST /v2/vcf-services/{id}/rollback  { "targetVersion": "9.1.0.0" }
   └─► OR automatic rollback (if configured)

3. New (failed) version → Maintenance Mode
   └─► Resources frozen

4. Previous version resumed
   └─► Resources re-enter reconciliation loop
   └─► Downgrade performed where possible

5. Resource handling
   ├─► New version resources   → Removed
   ├─► Transferred resources   → Ownership reverted to previous version
   └─► Original resources      → Restored

6. Failed version cleanup
   └─► Resources and version entity removed

7. Rollback complete
   └─► Previous version active and Healthy
```

### Rollback via API

```http request
POST /v2/vcf-services/{id}/rollback
Content-Type: application/json

{ "targetVersion": "9.1.0.0" }
```

### SupervisorService Downgrade Limitation

> **Important:** Once a `SupervisorService` has been successfully installed on a Supervisor cluster it **cannot be downgraded** to a previous version. Carvel kapp-controller does not support package downgrades, and data migrations may be irreversible.

If a rollback is required for a service that includes a `SupervisorService`, the workaround is:

1. Delete the service completely.
2. Reinstall the previous version from scratch.
3. Restore data from a backup taken before the upgrade.

This is why testing upgrades in a development environment and taking backups before upgrading production services is essential.

---

## Deletion

### Normal Deletion Flow

```text
1. DELETE /v2/vcf-services/{id}
   └─► Phase: Deleting, Status: Busy

2. Custom Resources removed
   └─► Finalizers honoured: each CR cleans up its target before being deleted
   └─► Resources without finalizers removed immediately

3. Service entity deleted
   └─► Status: Deleted
```

### Force Deletion

```http request
DELETE /v2/vcf-services/{id}?forceDelete=true
```

Force deletion proceeds immediately with resource cleanup and finalizer removal.

Use force deletion only when:
- The external system is no longer accessible.
- Manual cleanup of external resources is acceptable.

After a force delete, audit external systems (vCenter, Supervisor, VCF Automation RBAC) for orphaned resources and clean them up manually.

### Finalizer Behaviour

| | Resources with finalizers | Resources without finalizers |
| :---- | :---- | :---- |
| On deletion | Clean up target, then remove | Removed immediately; target left intact |
| Purpose | Graceful shutdown, prevent orphans | Transfer-friendly (used during upgrades) |

---

## Failure Handling

### Upgrade failure recovery options

| Option | When to use |
| :---- | :---- |
| **Manual fix** | Root cause is known; fix configuration or resource issue, then retry the upgrade |
| **Rollback** | Revert to the previous working version; investigate offline and retry later |
| **Disable auto-upgrade** | Prevent repeated failed attempts while a fix is prepared |

To disable automatic upgrade after a failure:

```http request
PATCH /v2/vcf-services/{id}
Content-Type: application/json

{ "autoUpgrade": false }
```

### Failure scenarios

| Failure point | Impact | Recovery |
| :---- | :---- | :---- |
| Pre-check failure | Upgrade not started | Fix the reported issue and retry |
| Resource creation failure | Partial upgrade | Rollback or fix and retry |
| Timeout | Upgrade stuck | Rollback or force-delete and reinstall |

---

## Best Practices

### Before installation

- Review the service EULA and access grants carefully before accepting them.
- Verify that target Supervisors meet the service's minimum version requirement.
- Check available storage classes and resource quotas.
- Preview effective values with `POST /render-effective-values` before activating.

### Before upgrading

- Test the upgrade in a development environment first.
- Back up any data managed by the service (especially for `SupervisorService` workloads).
- Read the release notes for the new version; note any schema changes to `userOverwrite` values.
- Plan a rollback procedure, including the Supervisor Service reinstallation path.
- Schedule a maintenance window for production upgrades.

### During upgrade

- Monitor `phase` and `status` continuously.
- Check `state.errorDetails` as soon as `status` becomes `Unhealthy`.
### Before deleting

- Confirm the service is not a dependency of other services.
- Back up any service data that cannot be recreated.
- After deletion, audit target systems for orphaned resources.

## Related Documents

- [VCF Service Overview](vcf-service-overview.md) - lifecycle states overview and distribution channels
- [API Reference](api.md) - complete endpoint reference with request/response schemas
- [Packaging and Build](packaging-and-build.md) - how to build the bundle tarball and Package CR YAML supplied to `source` during create/upgrade
- [Element Types Overview](../element-types/element-types-overview.md) - Custom Resource types managed during install/upgrade/delete
