locals {
  cp_ids_map      = var.cp_ids
  sanitized_map   = {
    for k, v in local.cp_ids_map :
    replace(replace(v, "*", "-"), "/", "-") => v
  }
  ws_url      = var.cloud_ws_url
}

module "ecs_simulator" {
  for_each = local.sanitized_map

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
  app_collector = "disabled"

  app_task_environment = [
    { name = "ENV", value = var.app_task_environment },
    { name = "WS_URL", value = local.ws_url },
    { name = "CP_ID", value = each.value }
  ]

  app_task_secrets = [
    {
      name      = "PASSWORD"
      valueFrom = "arn:aws:secretsmanager:eu-west-1:192351105085:secret:cs_simulator/cp_password-XPcOCk:cp_password::"
    }
  ]

}
