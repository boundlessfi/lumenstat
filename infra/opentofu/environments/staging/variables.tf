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
