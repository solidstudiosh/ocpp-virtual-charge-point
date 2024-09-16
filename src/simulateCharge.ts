import * as uuid from "uuid";
import { VCP } from "./vcp";
import {transactionManager} from "./v16/transactionManager";


const sleep = (delay: number) =>
  new Promise((resolve) => setTimeout(resolve, delay));

export async function simulateCharge(vcp: VCP, duration: number,randomDelay: boolean = false) {
  for (let i = 1; i <= 2; i++) {
    console.log(`charge session count: ${i}`);
    // if randomDelay, test charge will start between 500-120,000ms
    if (!randomDelay) {
      await sleep(500)
    }
    else {
      const minTime = 500;
      const maxTime = 120000;
      const randomStart = Math.floor(Math.random() * (maxTime - minTime)) + minTime;
      console.log(`random delay of ${randomStart} applied...`)
      await sleep(randomStart);
    }
    // initiate P&C charge session
    await vcp.sendAndWait({
      action: "StartTransaction",
      messageId: uuid.v4(),
      payload: {
        connectorId: 1,
        idTag: 'freevenIdTag', // -> for P&C
        meterStart: parseInt(process.env["INITIAL_METER_READINGS"] ?? "0"),
        timestamp: new Date(),
      },
    });
    // send charging statusNotification
    await sleep(500)
    await vcp.sendAndWait({
      action: "StatusNotification",
      messageId: uuid.v4(),
      payload: {
        connectorId: 1,
        errorCode: "NoError",
        status: "Charging",
      },
    });
    console.log("vcp charging...")
    // send stopNotification after set duration
    await sleep(duration);
    
    // gets transId by VCP instance
    let transId = transactionManager.getTransactionIdByVcp(vcp);
    console.log(`transactionId for stopNotif : ${transId}`);
  
    await vcp.sendAndWait({
      action: "StopTransaction",
      messageId: uuid.v4(),
      payload: {
        transactionId: transId,
        timestamp: new Date(),
        meterStop: 2000,
      },
    });
    console.log("StopTransaction is sent...")
    await sleep(500);
    await vcp.sendAndWait({
      action: "StatusNotification",
      messageId: uuid.v4(),
      payload: {
        connectorId: 1,
        errorCode: "NoError",
        status: "Finishing",
      },
    });
  }
}
