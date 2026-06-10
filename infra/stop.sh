#!/bin/bash
podman pod stop crm-pod
podman stop crm-pgadmin crm-auth 2>/dev/null || true
echo "✅ CRM backend stopped. Data is preserved in the crm-pgdata volume."
