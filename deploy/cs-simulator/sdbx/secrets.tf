data "local_file" "cp_password_json" {
  filename = "${path.module}/../../../terraform-secrets/terraform-non-prod-secrets/cs-simulator/sdbx/cp-password.json"
}

locals {
  cp_password = jsondecode(data.local_file.cp_password_json.content)
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
