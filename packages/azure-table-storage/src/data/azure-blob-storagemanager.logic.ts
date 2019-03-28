import { BlobService, ExponentialRetryPolicyFilter, ServiceResponse } from 'azure-storage';
import { IOperationResult, OperationResultStatus, IBlobStorageManager, IOperationResultWithData } from 'tsdatautils-core';
import { Readable, Writable } from 'stream';

export class AzureBlobOperationResult<T> implements IOperationResultWithData<T> {
    public status: OperationResultStatus;
    public error: Error;
    public message: string;
    public data: T;

    // tslint:disable-next-line:function-name
    public static buildSimpleError(errorString: string, errorObj: Error = null): AzureBlobOperationResult<any> {
        let azureRes: AzureBlobOperationResult<any> = new this();
        azureRes.status = OperationResultStatus.error;
        azureRes.message = errorString;

        if (errorObj === null) {
            azureRes.error = new Error(errorString);
        } else {
            azureRes.error = errorObj;
        }

        return azureRes;
    }
}

export class AzureBlobStorageManager implements IBlobStorageManager {
    private blobService: BlobService = null;
    private azureStorageAccount: string = '';
    private azureStorageKey: string = '';

    /**
     * Constructor.
     * @param azureStorageAccount The storage acount name or connection string.
     * @param azureStorageKey If no connection string was provided, this is the key to access the blob storage.
     */
    public constructor(azureStorageAccount: string = '', azureStorageKey: string = '') {
        this.azureStorageAccount = azureStorageAccount;
        this.azureStorageKey = azureStorageKey;
    }

    /**
     * Initializes a connection. Must at least pass in the storage account/connection string.
     */
    public initializeConnection(): void {
        let retryFilter: ExponentialRetryPolicyFilter = new ExponentialRetryPolicyFilter(0, 300, 300, 10000);
        if (this.azureStorageAccount !== '' && this.azureStorageKey !== '') {
            this.blobService = new BlobService(this.azureStorageAccount, this.azureStorageKey).withFilter(retryFilter);
        } else if (this.azureStorageAccount !== '') {
            this.blobService = new BlobService(this.azureStorageAccount).withFilter(retryFilter);
        } else {
            throw new Error('Must provide at least an account to call this.');
        }
    }

    public createContainerIfNotExists(containerName: string, containerOptions: BlobService.CreateContainerOptions = {}): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve: (val: IOperationResult) => void, reject: (reason: any) => void) => {
            this.blobService.createContainerIfNotExists(containerName, containerOptions, (err: Error, result: BlobService.ContainerResult, response: ServiceResponse) => {
                if (err !== undefined && err !== null) {
                    reject(err);

                    return;
                }

                let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
                promiseResult.status = OperationResultStatus.success;

                resolve(promiseResult);
            });
        });
    }

    public createBlobFromFile(container: string, blob: string, filePath: string, options: BlobService.CreateBlockBlobRequestOptions = {}): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve: (val: IOperationResult) => void, reject: (reason: any) => void) => {
            this.blobService.createBlockBlobFromLocalFile(container, blob, filePath, options, (err: Error, result: BlobService.BlobResult, response: ServiceResponse) => {
                if (err !== undefined && err !== null) {
                    reject(err);
    
                    return;
                }
    
                let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
                promiseResult.status = OperationResultStatus.success;
    
                resolve(promiseResult);
            });
        });
    }

    public createBlobWritingStream(container: string, blob: string, options: BlobService.CreateBlockBlobRequestOptions = {}): Promise<IOperationResultWithData<Writable>> {
        return new Promise<IOperationResultWithData<Writable>>((resolve: (val: IOperationResultWithData<Writable>) => void, reject: (reason: any) => void) => {
            /* let writableStream: Writable = this.blobService.createWriteStreamToBlockBlob(container, blob, options, (err: Error, result: BlobService.BlobResult, response: ServiceResponse) => {
                if (err !== undefined && err !== null) {
                    reject(err);
    
                    return;
                }
    
                let promiseResult: AzureBlobOperationResult<Writable> = new AzureBlobOperationResult();
                promiseResult.status = OperationResultStatus.success;
                promiseResult.data = writableStream;
    
                resolve(promiseResult);
            }); */
            let promiseResult: AzureBlobOperationResult<Writable> = new AzureBlobOperationResult();
            promiseResult.status = OperationResultStatus.success;
            promiseResult.data = this.blobService.createWriteStreamToBlockBlob(container, blob, options);

            resolve(promiseResult);
        });
    }

    public getBlobToFile(container: string, blob: string, outputFilePath: string, options: BlobService.GetBlobRequestOptions = {}): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve: (val: IOperationResult) => void, reject: (reason: any) => void) => {
            this.blobService.getBlobToLocalFile(container, blob, outputFilePath, options, (err: Error, result: BlobService.BlobResult, response: ServiceResponse) => {
                if (err !== undefined && err !== null) {
                    reject(err);
    
                    return;
                }
    
                let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
                promiseResult.status = OperationResultStatus.success;
    
                resolve(promiseResult);
            });
        });
    }

    public getBlobToStream(container: string, blob: string, stream: Writable, options: BlobService.GetBlobRequestOptions = {}): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve: (val: IOperationResult) => void, reject: (reason: any) => void) => {
            this.blobService.getBlobToStream(container, blob, stream, options, (err: Error, result: BlobService.BlobResult, response: ServiceResponse) => {
                if (err !== undefined && err !== null) {
                    reject(err);
    
                    return;
                }
    
                let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
                promiseResult.status = OperationResultStatus.success;
    
                resolve(promiseResult);
            });
        });
    }

    public deleteBlobIfExists(container: string, blob: string): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve: (val: IOperationResult) => void, reject: (reason: any) => void) => {
            this.blobService.deleteBlobIfExists(container, blob, (err: Error, result: boolean, response: ServiceResponse) => {
                if (err !== undefined && err !== null) {
                    reject(err);
    
                    return;
                }
    
                let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
                promiseResult.status = OperationResultStatus.success;
    
                resolve(promiseResult);
            });
        });
    }
}
