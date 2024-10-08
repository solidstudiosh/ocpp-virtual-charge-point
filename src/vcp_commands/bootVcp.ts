import * as uuid from "uuid";
import { VCP } from "../vcp";
// import {transactionManager} from "../v16/transactionManager";
import { sleep } from "../utils"

export async function bootVCP(vcp:VCP, sleepTime: number = 100) {
    if (vcp.isTwinGun) {
        console.log("loading twingun VCP...")
        // const connector1 = vcp.connectorIDs[0];
        // const connector2 = vcp.connectorIDs[1];
        await sleep(500);
        await vcp.sendAndWait({
            messageId: uuid.v4(),
            action: "BootNotification",
            payload: {
              chargePointVendor: "ATESS",
              chargePointModel: "EVA-07D-SEW",
              chargePointSerialNumber: "S001",
              firmwareVersion: "1.0.0",
            },
          });
          for (const connectorId of vcp.connectorIDs) {
            await sleep(sleepTime);
            await vcp.sendAndWait({
              messageId: uuid.v4(),
              action: "StatusNotification",
              payload: {
                connectorId: connectorId,
                errorCode: "NoError",
                status: "Preparing",
              },
            });
          }
          // await vcp.sendAndWait({
          //   messageId: uuid.v4(),
          //   action: "StatusNotification",
          //   payload: {
          //     connectorId: connector1,
          //     errorCode: "NoError",
          //     status: "Preparing",
          //   },
          // });
          // await sleep(sleepTime);
          // await vcp.sendAndWait({
          //   messageId: uuid.v4(),
          //   action: "StatusNotification",
          //   payload: {
          //     connectorId: connector2,
          //     errorCode: "NoError",
          //     status: "Preparing",
          //   },
          // });
          console.log("twingun VCP successfully loaded...")
    } else {
        console.log("loading single connector VCP...")
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
          console.log("single connector VCP successfully loaded...")
    }
}
