resource "aws_secretsmanager_secret" "cp_password" {
  name = "cs_simulator/cp_password"
  description = "Charge point password"

  tags = {
    env = "sdbx"
  }
}


