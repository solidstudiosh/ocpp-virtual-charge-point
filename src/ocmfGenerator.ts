import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import dayjs from "dayjs";

interface OCMFInput {
  startTime: Date;
  startEnergy: number;
  endTime: Date;
  endEnergy: number;
  idTag: string;
}

const TM_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ss,SSSZZ";

const generateOCMFData = (input: OCMFInput) => {
  return {
    FV: "1.0",
    GI: "SOLIDSTUDIO METER",
    GS: "90001337",
    GV: "123",
    PG: "T99",
    MV: "SOL",
    MM: "SOL.M.001",
    MS: "1234567890",
    MF: "999",
    IS: true,
    IT: "CENTRAL_2",
    ID: input.idTag,
    CT: "EVSEID",
    CI: "PLSOLE007",
    RD: [
      {
        TM: `${dayjs(input.startTime).format(TM_TIME_FORMAT)} I`,
        TX: "B",
        RV: input.startEnergy.toString(),
        RI: "01-00:98.08.00.FF",
        RU: "kWh",
        RT: "DC",
        EF: "",
        ST: "G",
      },
      {
        TM: `${dayjs(input.endTime).format(TM_TIME_FORMAT)} I`,
        TX: "E",
        RV: input.endEnergy.toString(),
        RI: "01-00:98.08.00.FF",
        RU: "kWh",
        RT: "DC",
        EF: "",
        ST: "G",
      },
    ],
  };
};

const generateOCMFSignature = (data: string) => {
  const sign = crypto.createSign("sha256");
  sign.update(data);
  const signature = sign
    .sign({
      key: fs.readFileSync(path.resolve("./cert/vcp.pem"), "utf8"),
    })
    .toString("hex");
  return { SA: "ECDSA-secp256k1-SHA256", SD: signature };
};

export const generateOCMF = (input: OCMFInput) => {
  const data = generateOCMFData(input);
  const signature = generateOCMFSignature(JSON.stringify(data));
  return `OCMF|${JSON.stringify(data)}|${JSON.stringify(signature)}`;
};

export const getOCMFPublicKey = () => {
  return fs.readFileSync(path.resolve("./cert/vcp.pub"));
};
