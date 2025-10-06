import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { diagnosticsStatusNotificationOcppMessage } from "./diagnosticsStatusNotification";
import { Client as FtpClient } from "basic-ftp";
import { URL } from "node:url";
import { Readable } from "node:stream";

const GetDiagnosticsReqSchema = z.object({
  location: z.string().url(),
  retries: z.number().int().nullish(),
  retryInterval: z.number().int().nullish(),
  startTime: z.string().datetime().nullish(),
  stopTime: z.string().datetime().nullish(),
});
type GetDiagnosticsReqType = typeof GetDiagnosticsReqSchema;

const GetDiagnosticsResSchema = z.object({
  fileName: z.string().max(255).nullish(),
});
type GetDiagnosticsResType = typeof GetDiagnosticsResSchema;

class GetDiagnosticsOcppMessage extends OcppIncoming<
  GetDiagnosticsReqType,
  GetDiagnosticsResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetDiagnosticsReqType>>,
  ): Promise<void> => {
    const fileName = `diagnostics_${new Date().toISOString()}.log`;

    // do not await this, it will block the OCPP response
    asyncUploadDiagnostics(vcp, call, fileName);

    vcp.respond(
      this.response(call, {
        fileName: fileName,
      }),
    );
  };
}

const asyncUploadDiagnostics = async (
  vcp: VCP,
  call: OcppCall<z.infer<GetDiagnosticsReqType>>,
  fileName: string,
) => {
  vcp.send(
    diagnosticsStatusNotificationOcppMessage.request({
      status: "Uploading",
    }),
  );

  const diagnosticData = await vcp.getDiagnosticData();

  try {
    // Ensure diagnosticData is properly stringified and formatted
    let diagnosticContent: string;
    try {
      // If diagnosticData is already a string, use it directly
      if (typeof diagnosticData === "string") {
        diagnosticContent = diagnosticData;
      } else {
        // If it's an object/array, stringify it
        diagnosticContent = JSON.stringify(diagnosticData, null, 2);
      }
    } catch (e) {
      // If JSON.stringify fails, convert to string
      diagnosticContent = String(diagnosticData);
    }

    // Parse FTP URL
    const ftpUrl = new URL(call.payload.location);
    const ftpClient = new FtpClient();
    ftpClient.ftp.verbose = true; // Enable verbose logging for debugging

    await ftpClient.access({
      host: ftpUrl.hostname,
      port: ftpUrl.port ? Number.parseInt(ftpUrl.port, 10) : 21,
      user: ftpUrl.username || "anonymous",
      password: ftpUrl.password || "guest",
      secure: false,
    });

    // Extract the directory path and ensure it exists
    const pathParts = ftpUrl.pathname.split("/").filter(Boolean);
    const remoteFileName = fileName;

    // If there are path parts, try to navigate to the directory
    if (pathParts.length > 0) {
      for (const part of pathParts) {
        try {
          await ftpClient.cd(part);
        } catch (e) {
          // If directory doesn't exist, try to create it
          await ftpClient.send(`MKD ${part}`);
          await ftpClient.cd(part);
        }
      }
    }

    // Create a buffer from the content and then a stream
    const buffer = Buffer.from(diagnosticContent, "utf8");
    const contentStream = Readable.from(buffer);

    // Upload the file using a stream
    await ftpClient.uploadFrom(contentStream, remoteFileName);

    await ftpClient.close();

    await new Promise((resolve) => setTimeout(resolve, 10000));
    vcp.send(
      diagnosticsStatusNotificationOcppMessage.request({
        status: "Uploaded",
      }),
    );
  } catch (err) {
    console.error("Error uploading diagnostic file via FTP:", err);
    vcp.send(
      diagnosticsStatusNotificationOcppMessage.request({
        status: "UploadFailed",
      }),
    );
    throw err;
  }
};

export const getDiagnosticsOcppMessage = new GetDiagnosticsOcppMessage(
  "GetDiagnostics",
  GetDiagnosticsReqSchema,
  GetDiagnosticsResSchema,
);
