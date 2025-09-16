variable "app_task_container_image" {
  description = "Docker Image to be deployed for the simulator"
  type        = string
  default     = "192351105085.dkr.ecr.eu-west-1.amazonaws.com/simulator:latest"
}

variable "app_task_environment" {
  description = "Environment name"
  type        = string
  default     = "sdbx"
}

variable "cp_ws_list" {
  description = "List of charge point IDs with associated WebSocket URLs"
  type = list(object({
    cp_id  = string
    ws_url = string
  }))
  default = [
    { cp_id = "FR*ORV*A0014", ws_url = "wss://ocpp.oreve.com" },
    { cp_id = "FR*ORV*A0015", ws_url = "wss://proxy.ocpp-proxy.prod.oreve.com" },
    { cp_id = "FR*ORV*A0016", ws_url = "wss://proxy.ocpp-proxy.prod.oreve.com" },
    { cp_id = "FR*ORV*A0017", ws_url = "wss://proxy.ocpp-proxy.prod.oreve.com" },
    { cp_id = "FR*ORV*B9019", ws_url = "wss://proxy.ocpp-proxy.prod.oreve.com" },
    { cp_id = "FR*ORV*A9998", ws_url = "wss://proxy.ocpp-proxy.prod.oreve.com" },
    { cp_id = "CS*SIMULATOR*1", ws_url = "wss://proxy.ocpp-proxy.prod.oreve.com" },
    { cp_id = "TEST*SIMULATOR*1", ws_url = "wss://proxy.ocpp-proxy.prod.oreve.com" },
    { cp_id = "TEST*SIMULATOR*2", ws_url = "wss://proxy.ocpp-proxy.prod.oreve.com" },
    { cp_id = "CS*SIMULATOR*1", ws_url = "wss://cpc.eu-stable.uat.charge.ampeco.tech:443/obornes" }
  ]
}
