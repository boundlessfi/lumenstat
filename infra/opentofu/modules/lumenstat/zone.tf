# Zone-wide resources. They exist once per zone, so only the environment with
# manage_zone = true (production) creates them.

locals {
  zone_settings = {
    ssl              = "strict" # Full (strict)
    always_use_https = "on"
    min_tls_version  = "1.2"
  }

  # The domain sends no mail. TXT content is quoted the way Cloudflare stores it.
  dmarc = join("; ", compact([
    "v=DMARC1",
    "p=reject",
    "sp=reject",
    "adkim=s",
    "aspf=s",
    var.dmarc_rua == "" ? "" : "rua=mailto:${var.dmarc_rua}",
  ]))

  mail_records = {
    spf   = { name = var.domain, type = "TXT", content = "\"v=spf1 -all\"", priority = null }
    dmarc = { name = "_dmarc.${var.domain}", type = "TXT", content = "\"${local.dmarc}\"", priority = null }
    mx    = { name = var.domain, type = "MX", content = ".", priority = 0 } # null MX (RFC 7505)
  }
}

resource "cloudflare_zone_dnssec" "this" {
  count = var.manage_zone ? 1 : 0

  zone_id = var.zone_id
  status  = "active"
}

resource "cloudflare_zone_setting" "this" {
  for_each = { for id, value in local.zone_settings : id => value if var.manage_zone }

  zone_id    = var.zone_id
  setting_id = each.key
  value      = each.value
}

resource "cloudflare_zone_setting" "hsts" {
  count = var.manage_zone ? 1 : 0

  zone_id    = var.zone_id
  setting_id = "security_header"
  value = {
    strict_transport_security = {
      enabled            = true
      max_age            = 15552000 # 6 months
      include_subdomains = true
      preload            = false
      nosniff            = true
    }
  }
}

resource "cloudflare_dns_record" "mail" {
  for_each = { for key, record in local.mail_records : key => record if var.manage_zone }

  zone_id  = var.zone_id
  name     = each.value.name
  type     = each.value.type
  content  = each.value.content
  priority = each.value.priority
  ttl      = 1
  comment  = "Lumenstat: this domain sends and receives no mail"
}

# The Free plan allows one rate limiting rule, with a 10 s period and timeout,
# counted per IP, and only Path (and Verified Bot) in the expression: Host and
# Method need Pro and Business. The path is only served by the dashboards, so
# this also covers staging. On a paid plan, narrow it, for example:
#   http.host eq "app.<domain>" and http.request.method eq "POST" and http.request.uri.path eq "/signup"
resource "cloudflare_ruleset" "rate_limit" {
  count = var.manage_zone ? 1 : 0

  zone_id = var.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules = [
    {
      ref         = "lumenstat_signup"
      description = "Lumenstat: limit signup requests per IP"
      expression  = "(http.request.uri.path eq \"${var.signup_path}\")"
      action      = "block"
      ratelimit = {
        characteristics     = ["ip.src", "cf.colo.id"]
        period              = 10
        requests_per_period = var.signup_requests_per_10s
        mitigation_timeout  = 10
      }
    },
  ]
}

# Docs (docs.<domain>) are hosted by Mintlify. The CNAME stays DNS-only so
# Mintlify can verify the domain and issue its own certificate; the TXT values
# come from the Mintlify dashboard after the domain is added there.
resource "cloudflare_dns_record" "docs" {
  count = var.docs == null ? 0 : 1

  zone_id = var.zone_id
  name    = var.docs.hostname
  type    = "CNAME"
  content = "cname.mintlify.builders"
  proxied = false
  ttl     = 1
  comment = "Lumenstat docs on Mintlify"
}

resource "cloudflare_dns_record" "docs_verification" {
  for_each = var.docs == null ? {} : var.docs.verification

  zone_id = var.zone_id
  name    = each.key
  type    = "TXT"
  content = "\"${each.value}\""
  ttl     = 1
  comment = "Lumenstat docs: Mintlify domain verification"
}
