import { IOperationResult, OperationResultStatus } from "./operation-result";

export interface IPubSubMessage<T> {
    base64: boolean;
    gzip: boolean;
    msg: string;
}

export class PubSubReceiveMessageResult implements IOperationResult {
    public status: OperationResultStatus;
    public error: Error;
    public message: string;

    public messageHandled: boolean;
}