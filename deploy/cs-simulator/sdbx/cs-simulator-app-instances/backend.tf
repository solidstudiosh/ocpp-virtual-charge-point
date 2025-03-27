terraform {
  backend "s3" {
    # Replace this with your bucket name!
    bucket         = "tfstate.sdbx.oreve.com"
    key            = "cs-simulator-app.sdbx.ecs.tfstate"
    region         = "eu-west-1"
    assume_role = {
      role_arn = "arn:aws:iam::192351105085:role/AtlantisCrossAccountRole-sdbx"
    }
    # use S3 State Locking
    use_lockfile   = true
    encrypt        = true
  }
}
