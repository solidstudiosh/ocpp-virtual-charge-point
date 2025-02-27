import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const NotifySettlementReqSchema = z.object({
  transactionId: z.string().max(36).nullish(),
  pspRef: z.string().max(255),
  status: z.enum(["Settled", "Canceled", "Rejected", "Failed"]),
  statusInfo: z.string().max(500).nullish(),
  settlementAmount: z.number(),
  settlementTime: z.string().datetime(),
  receiptId: z.string().max(50).nullish(),
  receiptUrl: z.string().max(2000).nullish(),
  vatNumber: z.string().max(20).nullish(),
  vatCompany: z
    .object({
      name: z.string().max(50),
      address1: z.string().max(100),
      address2: z.string().max(100),
      city: z.string().max(100),
      postalCode: z.string().max(20),
      country: z.string().max(50),
    })
    .nullish(),
});
type NotifySettlementReqType = typeof NotifySettlementReqSchema;

const NotifySettlementResSchema = z.object({
  receiptUrl: z.string().max(2000).nullish(),
  receiptId: z.string().max(50).nullish(),
});
type NotifySettlementResType = typeof NotifySettlementResSchema;

class NotifySettlementOcppOutgoing extends OcppOutgoing<
  NotifySettlementReqType,
  NotifySettlementResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifySettlementReqType>>,
    _result: OcppCallResult<z.infer<NotifySettlementResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifySettlementOcppOutgoing = new NotifySettlementOcppOutgoing(
  "NotifySettlement",
  NotifySettlementReqSchema,
  NotifySettlementResSchema,
);
