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

variable "cp_ws_map" {
  description = "Map of charge point IDs to their corresponding WebSocket URL"
  type        = map(string)
  default = {
    "FR*ORV*A0001"         = "ws://server.16.ocpp.obornes.solidstudio.io"
    "FR*ORV*A0002"         = "ws://server.16.ocpp.obornes.solidstudio.io"
    "FR*ORV*A0003"         = "ws://server.16.ocpp.dev.solid.oreve.com"
    "FR*ORV*A0001"         = "ws://server.16.ocpp.sandbox.solid.oreve.com"
    "FR*ORV*A0002"         = "ws://server.16.ocpp.sandbox.solid.oreve.com"
    "FR*ORV*A0003"         = "ws://server.16.ocpp.sandbox.solid.oreve.com"
    "FR*ORV*A0004"         = "ws://server.16.ocpp.sandbox.solid.oreve.com"
    "FR*ORV*4901*AA001*5*AC" = "ws://server.16.ocpp.sandbox.solid.oreve.com"
    "FR*ORV*4901*AA001*5*AC" = "ws://server.16.ocpp.obornes.solidstudio.io"
    "FR*ORV*A0004"         = "ws://server.16.ocpp.obornes.solidstudio.io"
    "FR*ORV*B0016"         = "ws://cpc.eu-stable.uat.charge.ampeco.tech:80/obornes"
  }
}
