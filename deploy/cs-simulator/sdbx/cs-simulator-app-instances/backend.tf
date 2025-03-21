terraform {
  backend "s3" {
    # Replace this with your bucket name!
    bucket         = "tfstate.sdbx.oreve.com"
    key            = "cs-simulator-app.sdbx.ecs.tfstate"
    region         = "eu-west-1"

    # Replace this with your DynamoDB table name!
    dynamodb_table = "tfstate-locks"
    encrypt        = true
  }
}
