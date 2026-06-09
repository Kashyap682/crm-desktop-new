#!/bin/bash
echo "⚠️  This will delete all containers AND all database data."
read -p "Are you sure? (yes/no): " confirm
[ "$confirm" != "yes" ] && echo "Aborted." && exit 0

podman pod stop crm-pod 2>/dev/null || true
podman pod rm crm-pod 2>/dev/null || true
podman stop crm-pgadmin 2>/dev/null || true
podman rm crm-pgadmin 2>/dev/null || true
podman volume rm crm-pgdata crm-pgadmin-data 2>/dev/null || true
echo "✅ All CRM containers and data removed."
