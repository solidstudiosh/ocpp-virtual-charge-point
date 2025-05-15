terraform {
  backend "s3" {
    # Replace this with your bucket name!
    bucket         = "tfstate.sdbx.oreve.com"
    key            = "cs-simulator-app.sdbx.ecs.tfstate"
    region         = "eu-west-1"

    # use S3 State Locking
    use_lockfile   = true
    encrypt        = true
  }
}
