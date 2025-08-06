import { IOperationResult, IOperationResultWithData, OperationResultStatus, QueueMessageResult } from "tsdatautils-core";

export class AzureQueueDocumentResult implements IOperationResult {
    public status: OperationResultStatus;
    public error: Error;
    public message: string;

    public constructor() {
        this.status = OperationResultStatus.pending;
    }

    public static buildSimpleError<T>(errorString: string, errorObj: Error = null): AzureQueueDocumentResult {
        const azureRes: AzureQueueDocumentResult = new this();
        azureRes.status = OperationResultStatus.error;
        azureRes.message = errorString;

        if (errorObj === null) {
            azureRes.error = new Error(errorString);
        } else {
            azureRes.error = errorObj;
        }

        return azureRes;
    }

    public static buildSuccess<T>(): AzureQueueDocumentResult {
        const azureRes: AzureQueueDocumentResult = new this();
        azureRes.status = OperationResultStatus.success;

        return azureRes;
    }
}

export class AzureQueueDocumentResultWithData<T> implements QueueMessageResult<T> {
    public status: OperationResultStatus;
    public error: Error;
    public message: string;
    public data: T;
    public messageId: string;

    public constructor() {
        this.status = OperationResultStatus.pending;
    }

    public static buildSimpleError<T>(errorString: string, errorObj: Error = null): AzureQueueDocumentResultWithData<T> {
        const azureRes: AzureQueueDocumentResultWithData<T> = new this();
        azureRes.status = OperationResultStatus.error;
        azureRes.message = errorString;

        if (errorObj === null) {
            azureRes.error = new Error(errorString);
        } else {
            azureRes.error = errorObj;
        }

        return azureRes;
    }

    public static buildSuccess<T>(data: T): AzureQueueDocumentResultWithData<T> {
        const azureRes: AzureQueueDocumentResultWithData<T> = new this();
        azureRes.status = OperationResultStatus.success;
        azureRes.data = data;

        return azureRes;
    }
}