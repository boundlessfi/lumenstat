terraform {
  required_version = ">= 1.8.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.29"
    }
  }

  # State is local by default (terraform.tfstate here, git-ignored). It holds the
  # tunnel token, so treat it as a secret. For shared remote state in Cloudflare R2,
  # create a private bucket and an R2 API token, export the token's key pair as
  # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, uncomment this, and run `tofu init -migrate-state`.
  #
  # backend "s3" {
  #   bucket                      = "<state bucket>"
  #   key                         = "lumenstat/staging.tfstate"
  #   region                      = "auto"
  #   endpoints                   = { s3 = "https://<account id>.r2.cloudflarestorage.com" }
  #   use_path_style              = true
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  #   skip_metadata_api_check     = true
  #   skip_s3_checksum            = true
  # }
}
