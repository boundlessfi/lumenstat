# Deploying Lumenstat on one server

`compose.yaml` runs the whole stack on a single Linux host with Docker: Postgres, Redis, the patched Umami, the OpenTelemetry collector, the writer, the dashboard, and `cloudflared`. **No port is published.** The only way in is a Cloudflare Tunnel that `cloudflared` opens outbound.

## Public hostnames

Create a remotely managed tunnel in Cloudflare and add these routes (Networking → Tunnels → your tunnel → Routes). The services are the Compose service names on the stack's private network.

| Hostname | Path | Service |
| --- | --- | --- |
| `app.<domain>` | (any) | `http://dashboard:3200` |
| `t.<domain>` | `^/(script\.js\|api/send\|e\|v/[0-9]+\.[0-9]+\.[0-9]+/l\.js)$` | `http://umami:3000` |
| `otlp.<domain>` | `^/v1/(traces\|metrics\|logs)$` | `http://collector:4318` |

The paths keep Umami's own admin UI and API off the internet: only the tracker (the versioned releases under `/v/` and the legacy `/script.js`) and the collect endpoint (`/e`, and the legacy `/api/send`) are reachable on `t.`.

`dashboard`'s `PUBLIC_UMAMI_URL` and `PUBLIC_COLLECTOR_URL` in `compose.yaml` hold the public tracker and OTLP addresses shown in setup snippets; change them for your domain.

## First deploy

From the repo root, with `vendor/umami` in place (`scripts/sync-umami.sh`):

```bash
deploy/deploy.sh <ssh host>
```

This copies the sources to `/srv/lumenstat/src` and runs `deploy/bootstrap.sh` there, which:

1. creates `/srv/lumenstat/.env` with random secrets (first run only, mode 600);
2. builds the images and starts everything except `cloudflared`;
3. replaces Umami's default `admin` / `umami` password with `UMAMI_ADMIN_PASSWORD` from the env file, over the private network;
4. starts `cloudflared` once `CLOUDFLARE_TUNNEL_TOKEN` is set in the env file.

Put the tunnel token in `/srv/lumenstat/.env` (never in git), then run `deploy/deploy.sh` again or `docker compose --profile public up -d` on the server.

## Updating

Run `deploy/deploy.sh <ssh host>` again. It rebuilds what changed and keeps the database volume and the env file.

## On the server

```bash
cd /srv/lumenstat/src/deploy
alias dc='docker compose --env-file /srv/lumenstat/.env -f compose.yaml'
dc ps                      # status
dc logs -f umami           # one service's logs
dc --profile public up -d  # everything, tunnel included
```

Every service has CPU and memory limits, so the stack can share a host with other projects.

## Privacy note

In this setup the tracker and OTLP hostnames go through Cloudflare, so Cloudflare sees visitor IPs. To keep visitor IPs away from any CDN, serve those two hostnames DNS-only from your own servers (for example behind Caddy with Let's Encrypt) and keep only the dashboard behind the tunnel.

## Infrastructure as code

[`infra/`](../infra/README.md) describes this setup as code: OpenTofu for the Cloudflare side (tunnel, routes, DNS, zone settings, signup rate limit) and Ansible to prepare an Ubuntu host and run the same steps as `deploy.sh`, for production and staging. It also explains how to import a zone and tunnel that were set up by hand.
