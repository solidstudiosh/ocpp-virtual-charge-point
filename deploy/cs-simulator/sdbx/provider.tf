terraform {
 required_providers {
   aws = {
     source  = "hashicorp/aws"
     version = "~> 5.82.2"
   }
 }
}

provider "aws" {
  region     = "eu-west-1"
  #assume_role {
    #role_arn = "arn:aws:iam::192351105085:role/AtlantisCrossAccountRole-sdbx"
  #}
}

