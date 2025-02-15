import { FastifyReply, FastifyRequest } from "fastify";
import { VCP } from "../vcp";
import { OcppVersion } from "../ocppVersion";
import { simulateCharge } from "../vcp_commands/simulateCharge";
import { bootVCP } from "../vcp_commands/bootVcp";
import { sleep } from "../utils";
// import dotenv from "dotenv";
import "dotenv/config";

export const startChargePoints = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const chargePoint = "";

  // const idPrefix: string = args["CP_PREFIX"] ?? process.env["CP_PREFIX"] ?? "VCP_";
  // const count: number = Number(args["COUNT"] ?? process.env["COUNT"] ?? 1);
  // const sleepTime: number = Number(args["SLEEP_TIME"] ?? process.env["SLEEP_TIME"] ?? 500);
  // const startChance: number = Number(args["START_CHANCE"] ?? process.env["START_CHANCE"] ?? 100);
  // const testCharge: boolean = args["TEST_CHARGE"] ?? process.env["TEST_CHARGE"] === "true" ?? false;
  // const duration: number = Number(args["DURATION"] ?? process.env["DURATION"] ?? 60000);
  // const randomDelay: boolean = args["RANDOM_DELAY"] ?? process.env["RANDOM_DELAY"] == "true" ?? false;
  // const isTwinGun: boolean = args["TWIN_GUN"] ?? process.env["TWIN_GUN"] === "true" ?? false;
  // const adminPort: string|undefined = args["ADMIN_PORT"] ?? process.env["ADMIN_PORT"] ?? undefined;
  // const adminPortIncrement: boolean = args["ADMIN_PORT_INCREMENT"] ?? process.env["ADMIN_PORT_INCREMENT"] === "true" ?? false;

  const endpoint = process.env.WS_URL;

  async function run() {
    const vcpList: VCP[] = [];
    const tasks: Promise<void>[] = []; // Array to hold promises
    let adminWsPort = undefined;

    for (let i = 1; i <= count; i++) {
      if ((i == 1 || adminPortIncrement) && adminPort != undefined) {
        adminWsPort = parseInt(adminPort) + (i - 1);
      } else {
        adminWsPort = undefined;
      }

      let vcp = new VCP({
        endpoint: endpoint,
        chargePointId: idPrefix + i,
        ocppVersion: OcppVersion.OCPP_1_6,
        isTwinGun: isTwinGun,
        adminWsPort: adminWsPort,
      });

      vcpList.push(vcp);

      let task = (async () => {
        // Start each VCP a second apart
        await sleep(i * vcpTimeGap);
        await vcp.connect();
        await bootVCP(vcp, sleepTime);
      })();
      tasks.push(task);
    }

    // Wait for all VCPs to be connected and initialized
    await Promise.all(tasks);
    console.log(`${vcpList.length} VCPs loaded...`);

    // After all VCPs have been initialized, start the simulateCharge function concurrently for each VCP
    if (testCharge) {
      const chargeTasks = vcpList.map((vcp) => {
        // VCP performs simulateCharge based on startChance
        const randomChance = Math.floor(Math.random() * 100);
        console.log(`randomChance: ${randomChance}`);
        if (randomChance <= startChance) {
          return simulateCharge(vcp, duration, randomDelay);
        } else {
          return Promise.resolve();
        }
      });
      await Promise.all(chargeTasks);
    }
  }

  run().catch(console.error);

  reply.send(chargePoint);
};

export const getChargePoints = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const chargePoints = [];

  reply.send(chargePoints);
};

export const changeStatus = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const chargePoint = {
    id: "1",
    name: "Charge Point 1",
    location: "Location 1",
  };

  reply.send(chargePoint);
};
