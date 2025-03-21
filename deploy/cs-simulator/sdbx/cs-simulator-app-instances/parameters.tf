resource "aws_ssm_parameter" "cloud_ws_url" {
  name  = "/cs_simulator/cloud_ws_url"
  type  = "String"
  value = "ws://server.16.ocpp.obornes.solidstudio.io"
}

resource "aws_ssm_parameter" "cp_ids" {
  name  = "/cs_simulator/cp_ids"
  type  = "String"
  value = jsonencode({
    cp_id_1 = "FR*ORV*B0005"
    cp_id_2 = "FR*ORV*B0006"
    cp_id_3 = "FR*ORV*B0007"
    cp_id_4 = "FR*ORV*B0008"
  })
}
