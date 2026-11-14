# Production: the `lumenstat` tunnel, its hostnames, and everything zone-wide.

# Reads the API token from CLOUDFLARE_API_TOKEN.
provider "cloudflare" {}

module "lumenstat" {
  source = "../../modules/lumenstat"

  account_id  = var.account_id
  zone_id     = var.zone_id
  domain      = var.domain
  tunnel_name = "lumenstat"

  hostnames = {
    app  = "app.${var.domain}"
    t    = "t.${var.domain}"
    otlp = "otlp.${var.domain}"
  }

  manage_zone = true
  dmarc_rua   = var.dmarc_rua
  docs        = var.docs
}
