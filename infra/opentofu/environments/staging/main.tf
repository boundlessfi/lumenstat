# Staging: its own tunnel and hostnames in the same zone. Zone-wide settings,
# mail records and the rate limiting rule belong to production.

# Reads the API token from CLOUDFLARE_API_TOKEN.
provider "cloudflare" {}

module "lumenstat" {
  source = "../../modules/lumenstat"

  account_id  = var.account_id
  zone_id     = var.zone_id
  domain      = var.domain
  tunnel_name = "lumenstat-staging"

  # One label below the zone on purpose: Universal SSL covers only first-level
  # subdomains, so app.staging.<domain> would get no edge certificate without
  # Advanced Certificate Manager. With it, these can become app.staging.<domain> etc.
  hostnames = {
    app  = "app-staging.${var.domain}"
    t    = "t-staging.${var.domain}"
    otlp = "otlp-staging.${var.domain}"
  }
}
