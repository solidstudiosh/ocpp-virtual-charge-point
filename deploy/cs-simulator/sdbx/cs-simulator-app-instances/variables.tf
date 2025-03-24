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

variable "cloud_ws_url" {
  description = "Websocket URL for cs-simulator"
  type        = string
  default     = "ws://server.16.ocpp.obornes.solidstudio.io"
}


variable "cp_ids" {
  description = "List of Charge Point IDs for cs-simulator instances"
  type        = list(string)
  default     = [
    "FR*ORV*B0005",
    "FR*ORV*B0006",
    "FR*ORV*B0007",
    "FR*ORV*B0008"
  ]
}

