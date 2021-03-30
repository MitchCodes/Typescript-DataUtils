import { IOperationResultWithData, OperationResultStatus } from "./operation-result";

export interface IQueueMessage<T> {
    base64: boolean;
    gzip: boolean;
    msg: string;
}

export class QueueMessageResult<T> implements IOperationResultWithData<T> {
    status: OperationResultStatus;
    error: Error;
    message: string;
    data: T;
    messageId: string;
}