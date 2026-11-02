export enum OcppVersion {
  OCPP_1_2 = "OCPP_1.2",
  OCPP_1_6 = "OCPP_1.6",
  OCPP_2_0_1 = "OCPP_2.0.1",
  OCPP_2_1 = "OCPP_2.1",
}

export const toProtocolVersion = (ocppVersion: OcppVersion): string => {
  if (ocppVersion === OcppVersion.OCPP_1_6) {
    return "ocpp1.6";
  }
  if (ocppVersion === OcppVersion.OCPP_2_0_1) {
    return "ocpp2.0.1";
  }
  if (ocppVersion === OcppVersion.OCPP_2_1) {
    return "ocpp2.1";
  }
  if (ocppVersion === OcppVersion.OCPP_1_2) {
    throw new Error("OCPP 1.2 is SOAP over HTTP, not a WebSocket subprotocol");
  }
  throw new Error(`Unrecognized OCPP version ${ocppVersion}`);
};
