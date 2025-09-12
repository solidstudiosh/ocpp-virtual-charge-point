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
    { cp_id = "FR*ORV*A0014", ws_url = "ws://server.16.ocpp.sdbx.solid.oreve.com" },
    { cp_id = "FR*ORV*A0015", ws_url = "ws://server.16.ocpp.sdbx.solid.oreve.com" }
    # { cp_id = "FR*ORV*A0001", ws_url = "ws://server.16.ocpp.sandbox.solid.oreve.com" },
    #{ cp_id = "FR*ORV*A0002", ws_url = "ws://server.16.ocpp.obornes.solidstudio.io" },
    # { cp_id = "FR*ORV*A0002", ws_url = "ws://server.16.ocpp.sandbox.solid.oreve.com" },
    # { cp_id = "FR*ORV*A0003", ws_url = "ws://server.16.ocpp.dev.solid.oreve.com" },
    # { cp_id = "FR*ORV*A0003", ws_url = "ws://server.16.ocpp.sandbox.solid.oreve.com" },
    # { cp_id = "FR*ORV*A0004", ws_url = "ws://server.16.ocpp.sandbox.solid.oreve.com" },
    #{ cp_id = "FR*ORV*A0004", ws_url = "ws://server.16.ocpp.obornes.solidstudio.io" },
    #{ cp_id = "FR*ORV*A0005", ws_url = "wss://proxy.ocpp.custom.solid.oreve.com" },
    #{ cp_id = "FR*ORV*A0014", ws_url = "wss://proxy.ocpp-proxy.test.oreve.com" },
    # { cp_id = "FR*ORV*4901*AA001*5*AC", ws_url = "ws://server.16.ocpp.sandbox.solid.oreve.com" },
    #{ cp_id = "FR*ORV*4901*AA001*5*AC", ws_url = "ws://server.16.ocpp.obornes.solidstudio.io" },
    #{ cp_id = "FR*ORV*B0016", ws_url = "ws://cpc.eu-stable.uat.charge.ampeco.tech:80/obornes" }
  ]
}
