export enum OperationResultStatus {
    pending = 0,
    executing = 1,
    success = 2,
    error = 3,
}

export interface IOperationResult {
    status: OperationResultStatus;
    error: Error;
    message: string;
}

export interface IOperationResultWithData<T> {
    status: OperationResultStatus;
    error: Error;
    message: string;
    data: T;
}
