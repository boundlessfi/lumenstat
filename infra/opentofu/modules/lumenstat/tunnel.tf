# The remotely managed tunnel that cloudflared on the server connects out to.
# The routes below are the only way into the stack: no port is published.

resource "cloudflare_zero_trust_tunnel_cloudflared" "this" {
  account_id = var.account_id
  name       = var.tunnel_name
  config_src = "cloudflare"
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "this" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.this.id

  config = {
    # Evaluated in order. Services are Compose service names on the stack's network.
    ingress = [
      {
        hostname = var.hostnames.app
        service  = "http://dashboard:3200"
      },
      {
        # Only the tracker script and the collect endpoints; Umami's own UI and API stay private.
        hostname = var.hostnames.t
        path     = "^/(script\\.js|api/send|e|v/[0-9]+\\.[0-9]+\\.[0-9]+/l\\.js)$"
        service  = "http://umami:3000"
      },
      {
        hostname = var.hostnames.otlp
        path     = "^/v1/(traces|metrics|logs)$"
        service  = "http://collector:4318"
      },
      {
        service = "http_status:404"
      },
    ]
  }
}

resource "cloudflare_dns_record" "tunnel" {
  for_each = var.hostnames

  zone_id = var.zone_id
  name    = each.value
  type    = "CNAME"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.this.id}.cfargotunnel.com"
  proxied = true
  ttl     = 1 # automatic; required for proxied records
  comment = "Lumenstat: tunnel ${var.tunnel_name}"
}

# The token cloudflared runs with (TUNNEL_TOKEN). Sensitive; it is also stored in the state.
data "cloudflare_zero_trust_tunnel_cloudflared_token" "this" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.this.id
}
