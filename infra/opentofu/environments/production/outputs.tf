output "tunnel_id" {
  value = module.lumenstat.tunnel_id
}

output "tunnel_token" {
  description = "tofu output -raw tunnel_token"
  value       = module.lumenstat.tunnel_token
  sensitive   = true
}

output "hostnames" {
  value = module.lumenstat.hostnames
}

output "dnssec_ds" {
  value = module.lumenstat.dnssec_ds
}
