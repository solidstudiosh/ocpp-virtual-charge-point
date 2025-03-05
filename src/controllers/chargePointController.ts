import { FastifyReply, FastifyRequest } from "fastify";
import { VCP } from "../vcp";
import { OcppVersion } from "../ocppVersion";
import { simulateCharge } from "../vcp_commands/simulateCharge";
import { bootVCP } from "../vcp_commands/bootVcp";
import { sleep } from "../utils";
import "dotenv/config";
import { v4 as uuid } from "uuid";
import WebSocket from "ws";
import {
  ChangeVcpStatusRequest,
  StartVcpRequest,
  StopVcpRequest,
} from "../schema";

let vcpList: VCP[] = [];

export const startVcp = async (
  request: FastifyRequest<{ Body: StartVcpRequest }>,
  reply: FastifyReply,
) => {
  const payload = request.body;

  // if count is greater than 1, require idPrefix
  if (payload.chargePointId) {
    startSingleVcp(payload);

    return reply.send({ message: `VCP with ${payload.chargePointId} started` });
  } else {
    startMultipleVcps(payload);

    return reply.send({ message: `${vcpList.length} VCPs started` });
  }
};

export const stopVcp = async (
  request: FastifyRequest<{ Body: StopVcpRequest }>,
  reply: FastifyReply,
) => {
  const { vcpId, vcpIdPrefix } = request.body;

  if (!vcpId && !vcpIdPrefix) {
    vcpList = [];

    reply.send({ message: "All VCPs stopped" });
  }

  if (vcpId) {
    vcpList = vcpList.filter((vcp) => vcp.vcpOptions.chargePointId !== vcpId);

    reply.send({ message: `VCP with ID: ${vcpId} stopped` });
  }

  if (vcpIdPrefix) {
    vcpList = vcpList.filter(
      (vcp) => !vcp.vcpOptions.chargePointId.startsWith(vcpIdPrefix),
    );

    reply.send({ message: `VCPs with ID prefix: ${vcpIdPrefix} stopped` });
  }
};

export const changeVcpStatus = async (
  request: FastifyRequest<{ Body: ChangeVcpStatusRequest }>,
  reply: FastifyReply,
) => {
  const { action, payload } = request.body;

  const adminWsUrl = process.env.ADMIN_WS_URL || "ws://127.0.0.1:9999";
  const adminWs = new WebSocket(adminWsUrl);

  adminWs.on("open", () => {
    adminWs.send(
      JSON.stringify({
        action,
        messageId: uuid(),
        payload,
      }),
    );

    adminWs.close();
  });

  reply.send({ message: "Status updated" });
};

export const getVcpStatus = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const response = vcpList.map((vcp: VCP) => {
    return {
      uuid: uuid(),
      isFinishing: vcp.isFinishing,
      isWaiting: vcp.isWaiting,
      lastAction: vcp.lastAction,
      connectorIDs: vcp.connectorIDs,
      ...vcp.vcpOptions,
    };
  });

  reply.send({ data: vcpList });
};

async function startMultipleVcps(payload: StartVcpRequest) {
  const {
    endpoint,
    idPrefix,
    count,
    sleepTime,
    startChance,
    testCharge,
    duration,
    randomDelay,
    isTwinGun,
    adminPort,
    adminPortIncrement,
    ocppVersion,
  } = payload;

  const tasks: Promise<void>[] = [];
  let adminWsPort = undefined;

  for (let i = 1; i <= count; i++) {
    if ((i === 1 || adminPortIncrement) && adminPort !== undefined) {
      adminWsPort = adminPort + (i - 1);
    } else {
      adminWsPort = undefined;
    }

    const vcp = new VCP({
      endpoint,
      chargePointId: idPrefix! + i,
      ocppVersion,
      isTwinGun,
      adminWsPort,
    });

    vcpList.push(vcp);

    const task = (async () => {
      // Start each VCP a second apart
      await sleep(i * 1000);
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

async function startSingleVcp(payload: StartVcpRequest) {
  const {
    endpoint,
    chargePointId,
    sleepTime,
    testCharge,
    duration,
    isTwinGun,
    ocppVersion,
    adminPort,
  } = payload;

  const vcp = new VCP({
    endpoint,
    chargePointId: chargePointId!,
    ocppVersion,
    adminWsPort: adminPort,
    isTwinGun,
  });

  vcpList.push(vcp);

  (async () => {
    await vcp.connect();
    bootVCP(vcp, sleepTime);

    if (testCharge) {
      simulateCharge(vcp, duration, false);
    }
  })();
}
