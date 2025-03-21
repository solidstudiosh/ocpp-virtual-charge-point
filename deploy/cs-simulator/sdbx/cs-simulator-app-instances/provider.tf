terraform {
 required_providers {
   aws = {
     source  = "hashicorp/aws"
     version = "~> 5.82.2"
   }
 }
}

provider "aws" {
 region = "eu-west-1"
}
