data "local_file" "otlp-connector-config" {
  filename = "${path.module}/../../../devops/config-otlp-collector.yaml"
}


# 🔹 Fetch secrets from SSM Parameter Store
data "aws_ssm_parameter" "cp_ids" {
  name = "/cs_simulator/cp_ids"
}

data "aws_ssm_parameter" "cloud_ws_url" {
  name = "/cs_simulator/cloud_ws_url"
}


# 🔹 Fetch secrets from Secrets Manager
data "aws_secretsmanager_secret_version" "cp_password" {
  secret_id = "cs_simulator/cp_password"
}

locals {
  cp_ids_map_raw  = jsondecode(data.aws_ssm_parameter.cp_ids.value)
  cp_ids_map      = { for k, v in local.cp_ids_map_raw : k => v }
  sanitized_map   = {
    for k, v in local.cp_ids_map :
    replace(replace(v, "*", "-"), "/", "-") => v
  }

  ws_url      = data.aws_ssm_parameter.cloud_ws_url.value
  cp_password = jsondecode(data.aws_secretsmanager_secret_version.cp_password.secret_string)["cp_password"]
}


module "ecs_simulator" {
  for_each = nonsensitive(local.sanitized_map)

  source = "github.com/Obornes/terraform-modules.git//modules/compute/ecs-app?ref=main"

  base_name    = "cs-${each.key}"
  cluster_name = "obornes-sdbx"
  env          = "sdbx"
  project      = "obornes"
  vpc_name     = "main-sdbx"

  app_task_container_image  = var.app_task_container_image
  app_task_cpu              = 256
  app_task_memory           = 512
  app_task_container_cpu    = 256
  app_task_container_memory = 512
  app_task_container_port   = 3000
  app_task_host_port        = 3000
  app_service_replicas      = 1
  enable_alb                = false

  app_task_environment = [
    { name = "ENV", value = var.app_task_environment },
    { name = "PYTHONPATH", value = "/work" },
    { name = "OTEL_PROPAGATORS", value = "xray" },
    { name = "OTEL_PYTHON_ID_GENERATOR", value = "xray" },
    { name = "OTEL_PYTHON_DISTRO", value = "aws_distro" },
    { name = "OTEL_PYTHON_CONFIGURATOR", value = "aws_configurator" },
    { name = "OTEL_LOG_LEVEL", value = "debug" },
    { name = "WS_URL", value = local.ws_url },
    { name = "CP_ID", value = each.value },
    { name = "PASSWORD", value = local.cp_password }
  ]

  app_task_oltp_environment = [
    { name = "OLTP_CONFIG", value = data.local_file.otlp-connector-config.content }
  ]
}
