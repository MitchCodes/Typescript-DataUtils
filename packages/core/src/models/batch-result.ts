import { IOperationResult } from './operation-result';

export enum BatchResultStatus {
    allError = 0,
    partialSuccess = 1,
    allSuccess = 2,
}

export interface IBatchResult {
    result: IOperationResult;
}

export interface IBatchResults {
    results: IBatchResult[];
    overallStatus: BatchResultStatus;
    getFailedTableBatches(): any;
}
