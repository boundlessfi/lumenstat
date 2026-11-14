output "tunnel_id" {
  description = "ID of the Cloudflare Tunnel."
  value       = cloudflare_zero_trust_tunnel_cloudflared.this.id
}

output "tunnel_token" {
  description = "Token for cloudflared (CLOUDFLARE_TUNNEL_TOKEN in /srv/lumenstat/.env)."
  value       = data.cloudflare_zero_trust_tunnel_cloudflared_token.this.token
  sensitive   = true
}

output "hostnames" {
  description = "Public hostnames routed through the tunnel."
  value       = var.hostnames
}

output "dnssec_ds" {
  description = "DS record to publish at the registrar (null unless manage_zone)."
  value       = one(cloudflare_zone_dnssec.this[*].ds)
}
