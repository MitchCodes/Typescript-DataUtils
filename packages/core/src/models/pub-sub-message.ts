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

export class PubsubDocumentResult implements IOperationResult {
    public status: OperationResultStatus;
    public error: Error;
    public message: string;

    public constructor() {
        this.status = OperationResultStatus.pending;
    }

    public static buildSimpleError<T>(errorString: string, errorObj: Error = null): PubsubDocumentResult {
        const azureRes: PubsubDocumentResult = new this();
        azureRes.status = OperationResultStatus.error;
        azureRes.message = errorString;

        if (errorObj === null) {
            azureRes.error = new Error(errorString);
        } else {
            azureRes.error = errorObj;
        }

        return azureRes;
    }

    public static buildSuccess<T>(): PubsubDocumentResult {
        const azureRes: PubsubDocumentResult = new this();
        azureRes.status = OperationResultStatus.success;

        return azureRes;
    }
}