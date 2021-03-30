import { IOperationResult, IOperationResultWithData, OperationResultStatus, QueueMessageResult } from "tsdatautils-core";

export class AzurePubsubDocumentResult implements IOperationResult {
    public status: OperationResultStatus;
    public error: Error;
    public message: string;

    public constructor() {
        this.status = OperationResultStatus.pending;
    }

    public static buildSimpleError<T>(errorString: string, errorObj: Error = null): AzurePubsubDocumentResult {
        let azureRes: AzurePubsubDocumentResult = new this();
        azureRes.status = OperationResultStatus.error;
        azureRes.message = errorString;

        if (errorObj === null) {
            azureRes.error = new Error(errorString);
        } else {
            azureRes.error = errorObj;
        }

        return azureRes;
    }

    public static buildSuccess<T>(): AzurePubsubDocumentResult {
        let azureRes: AzurePubsubDocumentResult = new this();
        azureRes.status = OperationResultStatus.success;

        return azureRes;
    }
}