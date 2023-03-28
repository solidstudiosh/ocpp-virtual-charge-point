export interface OcppCall<T = any> {
  messageId: string;
  action: string;
  payload: T;
}

export interface OcppCallResult<T = any> {
  messageId: string;
  action: string;
  payload: T;
}

export interface OcppCallError<T = any> {
  messageId: string;
  errorCode: string;
  errorDescription: string;
  errorDetails?: T;
}
