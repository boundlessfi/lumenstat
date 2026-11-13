#!/usr/bin/env bash
# Runs ON THE SERVER, from /srv/lumenstat/src/deploy. Safe to run again.
#
# 1. Creates /srv/lumenstat/.env with random secrets the first time.
# 2. Builds and starts everything except the tunnel.
# 3. Replaces Umami's default admin password before anything is public.
# 4. Starts the tunnel, if CLOUDFLARE_TUNNEL_TOKEN is set.
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=/srv/lumenstat/.env
rand() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-"${1:-40}"; }

if [ ! -f "$ENV_FILE" ]; then
  umask 077
  cat > "$ENV_FILE" <<EOF
POSTGRES_PASSWORD=$(rand)
UMAMI_APP_SECRET=$(rand 64)
SCF_COLLECTOR_SECRET=$(rand)
WRITER_OPERATOR_KEY=$(rand)
UMAMI_ADMIN_PASSWORD=$(rand 32)
CLOUDFLARE_TUNNEL_TOKEN=
EOF
  echo "Created $ENV_FILE with new secrets."
fi

dc() { docker compose --env-file "$ENV_FILE" -f compose.yaml "$@"; }

dc build
dc up -d --remove-orphans

echo "Waiting for Umami..."
for _ in $(seq 1 90); do
  if dc exec -T dashboard wget -qO /dev/null http://umami:3000/api/heartbeat 2>/dev/null; then break; fi
  sleep 5
done

# Replace the default admin/umami password, over the internal network only.
set -a; . "$ENV_FILE"; set +a
dc exec -T -e NEW_PASSWORD="$UMAMI_ADMIN_PASSWORD" dashboard node -e '
const base = "http://umami:3000";
const post = (path, body, token) => fetch(base + path, {
  method: "POST",
  headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
  body: JSON.stringify(body),
});
(async () => {
  const login = await post("/api/auth/login", { username: "admin", password: "umami" });
  if (!login.ok) { console.log("Default admin password already replaced."); return; }
  const { token } = await login.json();
  const res = await post("/api/me/password", { currentPassword: "umami", newPassword: process.env.NEW_PASSWORD }, token);
  if (!res.ok) { console.error("Password change failed:", res.status, await res.text()); process.exit(1); }
  console.log("Default admin password replaced (stored as UMAMI_ADMIN_PASSWORD in /srv/lumenstat/.env).");
})();
'

if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  dc --profile public up -d cloudflared
  echo "Tunnel started."
else
  echo "CLOUDFLARE_TUNNEL_TOKEN is empty; the stack is running but not reachable from the internet."
fi

dc ps --format "table {{.Service}}\t{{.Status}}"
