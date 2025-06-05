locals {
  cp_instances = {
    for idx, cp in var.cp_ws_list :
    "${replace(replace(cp.cp_id, "*", "-"), "/", "-")}-${idx}" => cp
  }
}

data "aws_secretsmanager_secret_version" "cp_password" {
  secret_id = "cs_simulator/cp_password"
}

module "ecs_simulator" {
  for_each = local.cp_instances

  source = "../../../tf-modules/terraform-modules/modules/compute/ecs-app"

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
  app_collector = "disabled"

app_task_environment = [
  { name = "ENV",     value = var.app_task_environment },
  { name = "WS_URL",  value = each.value["ws_url"] },
  { name = "CP_ID",   value = each.value["cp_id"] },
    {
    name  = "PASSWORD",
    value = jsondecode(data.aws_secretsmanager_secret_version.cp_password.secret_string)["CP_PASSWORD"]
  }
]

}