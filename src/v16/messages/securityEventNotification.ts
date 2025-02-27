import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const SecurityEventNotificationReqSchema = z.object({
  type: z.string().max(50),
  timestamp: z.string().datetime(),
  techInfo: z.string().max(255).nullish(),
});
type SecurityEventNotificationReqType =
  typeof SecurityEventNotificationReqSchema;

const SecurityEventNotificationResSchema = z.object({});
type SecurityEventNotificationResType =
  typeof SecurityEventNotificationResSchema;

class SecurityEventNotificationOcppMessage extends OcppOutgoing<
  SecurityEventNotificationReqType,
  SecurityEventNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<SecurityEventNotificationReqType>>,
    _result: OcppCallResult<z.infer<SecurityEventNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const securityEventNotificationOcppMessage =
  new SecurityEventNotificationOcppMessage(
    "SecurityEventNotification",
    SecurityEventNotificationReqSchema,
    SecurityEventNotificationResSchema,
  );
