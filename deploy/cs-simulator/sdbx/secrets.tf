locals {
  secrets_path = "${path.module}/../../../terraform-non-prod-secrets/cs-simulator/sdbx"

  cp_password       = jsondecode(file("${local.secrets_path}/cp-password.json"))
}

resource "aws_secretsmanager_secret" "cp_password" {
  name = "cs_simulator/cp_password"
  description = "Charge point password"
  tags        = { env = "sdbx" }
}

resource "aws_secretsmanager_secret_version" "cp_password" {
  secret_id     = aws_secretsmanager_secret.cp_password.id
  secret_string = jsonencode(local.cp_password)
}
