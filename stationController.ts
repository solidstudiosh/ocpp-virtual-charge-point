import {VCP} from "./src/vcp";
import {OcppVersion} from "./src/ocppVersion";
import {logger} from "./src/logger";
import type {OcppCall} from "./src/ocppMessage";
import {bootNotificationOcppMessage as bootNotification1_6_0} from "./src/v16/messages/bootNotification";
import {bootNotificationOcppOutgoing as bootNotification2_0_1} from "./src/v201/messages/bootNotification";
import {bootNotificationOcppOutgoing as bootNotification2_1} from "./src/v21/messages/bootNotification";
import {statusNotificationOcppMessage as statusNotification1_6} from "./src/v16/messages/statusNotification";
import {statusNotificationOcppOutgoing as statusNotification2_0_1} from "./src/v201/messages/statusNotification";
import {statusNotificationOcppOutgoing as statusNotification2_1} from "./src/v21/messages/statusNotification";

export type Station = {
    stationName: string,
    backendEndpoint: string,
    basicAuthPassword?: string,
    ocppVersion: string
}

export class StationController {
    private chargingStations: Map<String, VCP> = new Map<string, VCP>();

    async createStation(station: Station) {
        let existingStation = this.chargingStations.get(station.stationName);
        if (existingStation) {
            if (existingStation.isConnected()) { throw new Error(`Station ${station.stationName} already exists`); }
            existingStation.close();
        }

        const ocppVersion = Object.values(OcppVersion).find(version => version.toString() === station.ocppVersion) ?? OcppVersion.OCPP_2_1;

        const vcp = new VCP({
                endpoint: station.backendEndpoint ?? "ws://localhost:3000",
                chargePointId: station.stationName ?? "111222",
                ocppVersion,
                basicAuthPassword: station.basicAuthPassword ?? undefined
            }
        );

        try { await vcp.connect();} catch (e) {
            logger.error("Could not connect to backend", e);
        }
        if (!vcp.isConnected()) {
            throw new Error("Could not connect to backend");
        }


        vcp.send(this.getBootNotification(ocppVersion));
        vcp.send(this.getStatusNotification(ocppVersion));
        this.chargingStations.set(station.stationName, vcp);
    }


    send(stationName: string, ocppCall: OcppCall<any>) {
        this.chargingStations.get(stationName)?.send(ocppCall);
    }

    private getBootNotification(ocppVersion: OcppVersion) {
        switch (ocppVersion) {
            case OcppVersion.OCPP_1_6:
                return bootNotification1_6_0.request({
                    chargePointVendor: "Solidstudio",
                    chargePointModel: "VirtualChargePoint",
                    chargePointSerialNumber: "S001",
                    firmwareVersion: "1.0.0",
                })
            case OcppVersion.OCPP_2_0_1:
                return bootNotification2_0_1.request({
                    reason: "PowerUp",
                    chargingStation: {
                        model: "VirtualChargePoint",
                        vendorName: "Solidstudio",
                    }
                })
            case OcppVersion.OCPP_2_1:
                return bootNotification2_1.request({
                    reason: "PowerUp",
                    chargingStation: {
                        model: "VirtualChargePoint",
                        vendorName: "Solidstudio",
                    }
                })
        }
    }

    private getStatusNotification(ocppVersion: OcppVersion) {
        switch (ocppVersion) {
            case OcppVersion.OCPP_1_6:
                return statusNotification1_6.request({
                    connectorId: 1,
                    errorCode: "NoError",
                    status: "Available",
                });
            case OcppVersion.OCPP_2_0_1:
                return statusNotification2_0_1.request({
                    evseId: 1,
                    connectorId: 1,
                    connectorStatus: "Available",
                    timestamp: new Date().toISOString()
                });
            case OcppVersion.OCPP_2_1:
                return statusNotification2_1.request({
                    evseId: 1,
                    connectorId: 1,
                    connectorStatus: "Available",
                    timestamp: new Date().toISOString(),
                })
        }
    }
}