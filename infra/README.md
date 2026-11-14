# Infrastructure as code

The same single-server setup as [`deploy/`](../deploy/README.md), described as code:

- **`opentofu/`** manages Cloudflare: the remotely managed tunnel and its routes, the proxied DNS records for it, and the zone-wide settings (DNSSEC, TLS, HSTS, no-mail records, the signup rate limit).
- **`ansible/`** prepares an Ubuntu 24.04 host (unattended upgrades, firewall, SSH hardening, Docker) and deploys the stack the way `deploy/deploy.sh` does.

`deploy/deploy.sh` keeps working on its own; this is the repeatable version of it.

## Environments

| | Production | Staging |
| --- | --- | --- |
| Tunnel | `lumenstat` | `lumenstat-staging` |
| Dashboard | `app.<domain>` | `app-staging.<domain>` |
| Tracker (Umami) | `t.<domain>` | `t-staging.<domain>` |
| OTLP | `otlp.<domain>` | `otlp-staging.<domain>` |
| Zone-wide settings | managed here | not touched |
| Server | its own host | its own host |

Both environments live in the same zone. Staging names stay one label below the zone because the Free plan's Universal SSL certificate covers only first-level subdomains; `app.staging.<domain>` would need Advanced Certificate Manager (then change the names in `environments/staging/main.tf`).

Each host runs one stack in `/srv/lumenstat`, so staging needs its own server.

Note that `deploy/compose.yaml` sets the dashboard's `PUBLIC_UMAMI_URL` and `PUBLIC_COLLECTOR_URL` to the production hostnames; on staging the setup snippets show those until that is made configurable.

## What OpenTofu manages

`opentofu/modules/lumenstat` is the shared module; `opentofu/environments/{production,staging}` are the root modules that call it, each with its own state.

Per environment:

- the tunnel (`config_src = "cloudflare"`) and its routes, in this order:

  | Hostname | Path | Service |
  | --- | --- | --- |
  | `app.` | (any) | `http://dashboard:3200` |
  | `t.` | `^/(script\.js\|api/send\|e\|v/[0-9]+\.[0-9]+\.[0-9]+/l\.js)$` | `http://umami:3000` |
  | `otlp.` | `^/v1/(traces\|metrics\|logs)$` | `http://collector:4318` |
  | anything else | | `http_status:404` |

- proxied CNAMEs for the three hostnames to `<tunnel id>.cfargotunnel.com`;
- the tunnel token, as the sensitive output `tunnel_token`.

Production only (`manage_zone = true`):

- DNSSEC on (`tofu output dnssec_ds` is the DS record for the registrar);
- SSL Full (strict), Always Use HTTPS, minimum TLS 1.2, HSTS (6 months, subdomains, no preload, with `nosniff`);
- no mail: `v=spf1 -all`, DMARC `p=reject` (with `rua` only if `dmarc_rua` is set), null MX;
- the zone's one rate limiting rule: 5 requests per 10 s per IP to `/signup`, then a 10 s block. The Free plan allows only the path in that rule's expression (host and method need Pro and Business), so it applies to `/signup` on every hostname, which in practice means both dashboards.

## Order

1. **OpenTofu** creates the tunnel, its routes and the DNS records (and, in production, the zone settings).
2. **Token**: `tofu output -raw tunnel_token` goes into the Ansible secret `lumenstat_cloudflare_tunnel_token`, or by hand into `CLOUDFLARE_TUNNEL_TOKEN=` in `/srv/lumenstat/.env`.
3. **Ansible** prepares the host, copies the sources to `/srv/lumenstat/src`, runs `deploy/bootstrap.sh`, writes the token and starts `cloudflared`.

## OpenTofu

Requires OpenTofu 1.8 or newer and a Cloudflare API token in `CLOUDFLARE_API_TOKEN`, limited to this account and zone, with at least: Account › Cloudflare Tunnel: Edit; Zone › DNS: Edit, Zone Settings: Edit, Zone WAF: Edit (for the rate limiting rule). Staging needs only the tunnel and DNS permissions.

```bash
cd infra/opentofu/environments/staging        # or production
cp terraform.tfvars.example terraform.tfvars   # account and zone IDs (git-ignored)
tofu init
tofu plan
tofu apply
tofu output -raw tunnel_token                  # for the next step; do not paste it anywhere public
```

State is local by default. It contains the tunnel token, so keep it off shared drives and out of git (`.gitignore` covers it), or move it to a private Cloudflare R2 bucket with the commented `backend "s3"` block in `versions.tf`. OpenTofu's [state encryption](https://opentofu.org/docs/language/state/encryption/) can encrypt it as well.

The provider is pinned to `cloudflare/cloudflare ~> 5.29` and locked in `.terraform.lock.hcl`.

## Ansible

Requires a current Ansible on your machine (ansible-core 2.19 or newer, which the current `community.general` expects), `vendor/umami` in place (`scripts/sync-umami.sh`), and a server with Ubuntu 24.04 where you can log in as a **sudo user with your SSH key** (not root). That user becomes the deploy user, as with `deploy.sh`: it owns `/srv/lumenstat` and joins the `docker` group.

```bash
cd infra/ansible
ansible-galaxy collection install -r requirements.yml
cp inventories/staging/hosts.example.yml inventories/staging/hosts.yml   # real host (git-ignored)
ansible-playbook -i inventories/staging/hosts.yml site.yml               # add -K if sudo asks for a password
```

For production, use `inventories/production/hosts.yml`.

Roles:

- **base**: unattended upgrades; ufw with SSH allowed and incoming denied by default, added to any existing rules (nothing is reset); SSH with keys only and no root login. The SSH change stops with an error if Ansible is logged in as root or the login user has no valid key in `~/.ssh/authorized_keys`, and sshd is only reloaded (open sessions stay) after `sshd -t` passes. Still, keep a session open and test a fresh login after the first run. Set `base_ssh_hardening: false` to leave SSH alone, `base_fail2ban: true` for fail2ban.
- **docker**: Docker Engine, buildx and the compose plugin from Docker's apt repository. If Docker is already installed (another project on the host), it is left as it is.
- **lumenstat**: packs `apps`, `deploy`, `vendor/umami`, `patches`, `packages` (if present), `README.md` and `LICENSE` without `node_modules`, `.next`, `.git` or `.env*`, unpacks them into `/srv/lumenstat/src`, runs `deploy/bootstrap.sh`, and, when `lumenstat_cloudflare_tunnel_token` is set, writes it to `/srv/lumenstat/.env` (mode 600, never logged) and (re)starts `cloudflared`.

The playbook touches only `/srv/lumenstat`, the `lumenstat` Compose project and the host defaults above; other projects' containers, networks and firewall rules are left alone. No port is published, so the stack is reachable only through the tunnel.

## Secrets

Nothing secret goes into this repository: no API token, tunnel token, `.tfvars`, real inventory or env file. `.gitignore` here covers state, `*.tfvars`, `imports.tf`, `hosts.yml` and inventory `group_vars`/`host_vars`.

Keep per-environment secrets in files encrypted with [SOPS](https://github.com/getsops/sops) and [age](https://github.com/FiloSottile/age), stored outside this public repo (for example in a private operations repo):

```bash
# OpenTofu: a dotenv file with CLOUDFLARE_API_TOKEN=..., TF_VAR_account_id=..., TF_VAR_zone_id=...
sops exec-env <secrets>/cloudflare-production.sops.env 'tofu plan'

# Ansible: a YAML file with lumenstat_cloudflare_tunnel_token: ...
sops exec-file --no-fifo <secrets>/ansible-production.sops.yml \
  'ansible-playbook -i inventories/production/hosts.yml site.yml -e @{}'
```

The server keeps its own secrets in `/srv/lumenstat/.env`, created by `bootstrap.sh` on the first run.

## Adopting an existing setup

If the zone, tunnel and records were created by hand, import them before the first `apply`; otherwise OpenTofu tries to create a second tunnel, duplicate DNS records and a second rate limiting ruleset.

1. Find the IDs, with an API token in `CLOUDFLARE_API_TOKEN`:

   ```bash
   # Tunnel ID (also on Networking > Tunnels)
   curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel?name=lumenstat&is_deleted=false" | jq -r '.result[].id'
   # DNS record IDs
   curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?per_page=100" | jq -r '.result[] | [.id, .type, .name] | @tsv'
   # Rate limiting ruleset ID
   curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets/phases/http_ratelimit/entrypoint" | jq -r '.result.id'
   ```

2. In `environments/production`, `cp imports.tf.example imports.tf` and fill in the IDs. Drop the blocks for anything that does not exist yet; `apply` creates it.
3. `tofu plan` must show the imports and at most small in-place updates (for example HSTS, which is new). If it wants to replace or create the tunnel or a record, fix the ID first.
4. `tofu apply`, then delete `imports.tf`.

The imported tunnel keeps its token, so the server's `/srv/lumenstat/.env` stays valid. Staging is new and has nothing to import.
