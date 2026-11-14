variable "account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID of var.domain."
  type        = string
}

variable "domain" {
  description = "The zone apex."
  type        = string
  default     = "lumenstat.com"
}

variable "dmarc_rua" {
  description = "Address for DMARC aggregate reports, without mailto:. Empty means none."
  type        = string
  default     = ""
}

variable "docs" {
  description = "Docs site on Mintlify: hostname, and the TXT verification records Mintlify shows for it. Null skips the docs records."
  type = object({
    hostname     = string
    verification = map(string)
  })
  default = null
}
