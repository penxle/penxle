provider "aws" {
  region = "ap-northeast-2"

  default_tags {
    tags = { "ManagedBy" = "terraform" }
  }
}

provider "cloudflare" {}

provider "random" {}

provider "vercel" {
  team = "penxle"
}
