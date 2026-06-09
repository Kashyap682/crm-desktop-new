#!/bin/bash
set -e

source "$(dirname "$0")/.env"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
POD_NAME="crm-pod"
PG_CONTAINER="crm-postgres"
PGREST_CONTAINER="crm-postgrest"
PGADMIN_CONTAINER="crm-pgadmin"
PG_DATA_VOLUME="crm-pgdata"
PGADMIN_DATA_VOLUME="crm-pgadmin-data"

echo "==> Creating Podman pod..."
podman pod exists "$POD_NAME" 2>/dev/null || \
  podman pod create --name "$POD_NAME" -p 5432:5432 -p 3000:3000

echo "==> Starting PostgreSQL..."
if ! podman container exists "$PG_CONTAINER"; then
  podman run -d \
    --pod "$POD_NAME" \
    --name "$PG_CONTAINER" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -v "$PG_DATA_VOLUME":/var/lib/postgresql/data:Z \
    -v "$SCRIPT_DIR/migrations":/docker-entrypoint-initdb.d:Z,ro \
    docker.io/postgres:16-alpine
else
  podman start "$PG_CONTAINER"
fi

echo "==> Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  podman exec "$PG_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    > /dev/null 2>&1 && break
  echo "   waiting... ($i/30)"
  sleep 2
done

echo "==> Starting PostgREST..."
if ! podman container exists "$PGREST_CONTAINER"; then
  podman run -d \
    --pod "$POD_NAME" \
    --name "$PGREST_CONTAINER" \
    -e PGRST_DB_URI="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB" \
    -e PGRST_DB_SCHEMA="$PGRST_DB_SCHEMA" \
    -e PGRST_DB_ANON_ROLE="$PGRST_DB_ANON_ROLE" \
    -e PGRST_SERVER_PORT="$PGRST_SERVER_PORT" \
    -e PGRST_OPENAPI_SERVER_PROXY_URI="http://localhost:3000" \
    docker.io/postgrest/postgrest:v12.2.0
else
  podman start "$PGREST_CONTAINER"
fi

echo "==> Starting pgAdmin..."
if ! podman container exists "$PGADMIN_CONTAINER"; then
  podman run -d \
    --name "$PGADMIN_CONTAINER" \
    -p 8080:80 \
    -e PGADMIN_DEFAULT_EMAIL="$PGADMIN_EMAIL" \
    -e PGADMIN_DEFAULT_PASSWORD="$POSTGRES_PASSWORD" \
    -e PGADMIN_CONFIG_SERVER_MODE="False" \
    -e PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED="False" \
    -v "$PGADMIN_DATA_VOLUME":/var/lib/pgadmin:Z \
    docker.io/dpage/pgadmin4:latest
else
  podman start "$PGADMIN_CONTAINER"
fi

echo ""
echo "✅ CRM backend is running:"
echo "   PostgreSQL  → localhost:5432         (db: $POSTGRES_DB, user: $POSTGRES_USER)"
echo "   PostgREST   → http://localhost:3000"
echo "   pgAdmin     → http://localhost:8080  (login: $PGADMIN_EMAIL / $POSTGRES_PASSWORD)"
echo ""
echo "   pgAdmin server connection:"
echo "     Host: host.containers.internal   Port: 5432"
echo "     DB:   $POSTGRES_DB   User: $POSTGRES_USER   Password: $POSTGRES_PASSWORD"
