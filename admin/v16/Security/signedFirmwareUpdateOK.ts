import { securityEventNotificationOcppMessage } from "../../../src/v16/messages/securityEventNotification";
import { signedFirmwareStatusNotificationOcppMessage } from "../../../src/v16/messages/signedFirmwareStatusNotification";
import { statusNotificationOcppMessage } from "../../../src/v16/messages/statusNotification";
import { sendAdminCommand } from "../../admin";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  sendAdminCommand(
    signedFirmwareStatusNotificationOcppMessage.request({
      status: "Downloading",
    }),
  );
  await sleep(2000);
  sendAdminCommand(
    signedFirmwareStatusNotificationOcppMessage.request({
      status: "Downloaded",
    }),
  );
  await sleep(2000);
  sendAdminCommand(
    signedFirmwareStatusNotificationOcppMessage.request({
      status: "SignatureVerified",
    }),
  );
  sendAdminCommand(
    statusNotificationOcppMessage.request({
      status: "Unavailable",
      connectorId: 1,
      errorCode: "NoError",
    }),
  );
  await sleep(2000);
  sendAdminCommand(
    signedFirmwareStatusNotificationOcppMessage.request({
      status: "Installing",
    }),
  );
  await sleep(2000);
  sendAdminCommand(
    signedFirmwareStatusNotificationOcppMessage.request({
      status: "InstallRebooting",
    }),
  );
  await sleep(2000);
  sendAdminCommand(
    securityEventNotificationOcppMessage.request({
      timestamp: new Date().toISOString(),
      type: "FirmwareUpdated",
    }),
  );
  sendAdminCommand(
    statusNotificationOcppMessage.request({
      status: "Available",
      connectorId: 1,
      errorCode: "NoError",
    }),
  );
  await sleep(2000);
  sendAdminCommand(
    signedFirmwareStatusNotificationOcppMessage.request({
      status: "Installed",
    }),
  );
})().then(() => {});
