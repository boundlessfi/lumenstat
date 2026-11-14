variable "account_id" {
  description = "Cloudflare account ID that owns the tunnel."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID of var.domain."
  type        = string
}

variable "domain" {
  description = "The zone apex, e.g. lumenstat.com."
  type        = string
}

variable "tunnel_name" {
  description = "Name of the remotely managed Cloudflare Tunnel for this environment."
  type        = string
}

variable "hostnames" {
  description = "Public hostnames routed through the tunnel: the dashboard, the tracker (Umami) and OTLP."
  type = object({
    app  = string
    t    = string
    otlp = string
  })
}

variable "manage_zone" {
  description = "Also manage the zone-wide resources: DNSSEC, TLS and HSTS settings, the no-mail records and the rate limiting rule. Set it in exactly one environment."
  type        = bool
  default     = false
}

variable "dmarc_rua" {
  description = "Address for DMARC aggregate reports, without mailto:. Empty means no rua tag."
  type        = string
  default     = ""

  validation {
    condition     = var.dmarc_rua == "" || can(regex("^[^@\\s]+@[^@\\s]+$", var.dmarc_rua))
    error_message = "dmarc_rua must be an email address or empty."
  }
}

variable "signup_path" {
  description = "Path of the dashboard's signup page, rate limited per IP."
  type        = string
  default     = "/signup"
}

variable "signup_requests_per_10s" {
  description = "Requests per IP to signup_path allowed in 10 seconds before Cloudflare blocks that IP for 10 seconds."
  type        = number
  default     = 5
}

variable "docs" {
  description = "Optional docs site on Mintlify. hostname gets a DNS-only CNAME to Mintlify; verification maps each TXT record name Mintlify shows (e.g. _acme-challenge.docs.lumenstat.com) to its value. Null means no docs records."
  type = object({
    hostname     = string
    verification = map(string)
  })
  default = null
}
