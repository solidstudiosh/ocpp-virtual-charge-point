import * as uuid from "uuid";
import { VCP } from "../vcp";
import { sleep } from "../utils";

export async function bootVCP(vcp: VCP, sleepTime: number = 500) {
  if (vcp.isTwinGun) {
    console.log("loading twingun VCP...");
    console.log("Connector IDs:", vcp.connectorIDs);

    await sleep(500);
    await vcp.sendAndWait({
      messageId: uuid.v4(),
      action: "BootNotification",
      payload: {
        chargePointVendor: "Vestel",
        chargePointModel: "EVC10",
        chargePointSerialNumber: "S001",
        firmwareVersion: "1.0.0",
      },
    });
    for (let connectorId of vcp.connectorIDs) {
      console.log(
        `Attempting to send StatusNotification for connectorId: ${connectorId}`,
      );
      await sleep(sleepTime);
      try {
        await Promise.race([
          vcp.sendAndWait({
            messageId: uuid.v4(),
            action: "StatusNotification",
            payload: {
              connectorId: connectorId,
              errorCode: "NoError",
              status: "Preparing",
            },
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("sendAndWait timeout")), 5000),
          ),
        ]);
      } catch (error) {
        console.error(
          `Error or timeout sending StatusNotification for connectorId: ${connectorId}`,
          error,
        );
      }
    }
    console.log("twingun VCP successfully loaded...");
  } else {
    console.log("loading single connector VCP...");
    await sleep(100);
    await vcp.sendAndWait({
      messageId: uuid.v4(),
      action: "BootNotification",
      payload: {
        chargePointVendor: "ATESS",
        chargePointModel: "EVA-07S-SE",
        chargePointSerialNumber: "S001",
        firmwareVersion: "1.0.0",
      },
    });
    await sleep(100);
    await vcp.sendAndWait({
      messageId: uuid.v4(),
      action: "StatusNotification",
      payload: {
        connectorId: vcp.connectorIDs[0],
        errorCode: "NoError",
        status: "Preparing",
      },
    });
    console.log("single connector VCP successfully loaded...");
  }
}
