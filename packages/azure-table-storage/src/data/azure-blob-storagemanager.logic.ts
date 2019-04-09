import { BlobService, ExponentialRetryPolicyFilter, ServiceResponse, common } from 'azure-storage';
import { IOperationResult, OperationResultStatus, IBlobStorageManager, IOperationResultWithData, Dictionary, BlobInfo } from 'tsdatautils-core';
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

    public deleteContainerIfExists(container: string): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve: (val: IOperationResult) => void, reject: (reason: any) => void) => {
            this.blobService.deleteContainerIfExists(container, (err: Error, result: boolean, response: ServiceResponse) => {
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

    public getBlobToStream(container: string, blob: string, stream: Writable, options: BlobService.GetBlobRequestOptions = {}): Promise<IOperationResultWithData<BlobInfo>> {
        return new Promise<IOperationResultWithData<BlobInfo>>((resolve: (val: IOperationResultWithData<BlobInfo>) => void, reject: (reason: any) => void) => {
            this.blobService.getBlobToStream(container, blob, stream, options, (err: Error, result: BlobService.BlobResult, response: ServiceResponse) => {
                if (err !== undefined && err !== null) {
                    reject(err);
    
                    return;
                }
    
                let promiseResult: AzureBlobOperationResult<BlobInfo> = new AzureBlobOperationResult<BlobInfo>();
                promiseResult.status = OperationResultStatus.success;

                let blobInfo: BlobInfo = new BlobInfo();
                blobInfo.contentLength = result.contentLength;
                blobInfo.containerName = container;
                if (result.contentSettings !== undefined && result.contentSettings !== null) {
                    if (result.contentSettings.contentEncoding !== undefined && result.contentSettings.contentEncoding !== null) {
                        blobInfo.contentEncoding = result.contentSettings.contentEncoding;
                    }
                    if (result.contentSettings.contentType !== undefined && result.contentSettings.contentType !== null) {
                        blobInfo.contentType = result.contentSettings.contentType;
                    }
                }
                blobInfo.creationTime = new Date(result.creationTime);
                blobInfo.deleted = result.deleted;
                if (result.deletedTime !== undefined && result.deletedTime !== null && result.deletedTime !== '') {
                    blobInfo.deletedTime = new Date(result.deletedTime);
                }
                if (result.lastModified !== undefined && result.lastModified !== null && result.lastModified !== '') {
                    blobInfo.lastModifiedTime = new Date(result.lastModified);
                }
                blobInfo.name = blob;

                promiseResult.data = blobInfo;
    
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

    public getBlobs(container: string): Promise<IOperationResultWithData<Dictionary<BlobInfo>>> {
        return new Promise<IOperationResultWithData<Dictionary<BlobInfo>>>((resolve: (val: IOperationResultWithData<Dictionary<BlobInfo>>) => void, reject: (reason: any) => void) => {
            let returnDict: Dictionary<BlobInfo> = {};

            this.getBlobsContinuation(container, null, returnDict).then((res: IOperationResultWithData<Dictionary<BlobInfo>>) => {
                resolve(res);
            }).catch((err: any) => {
                reject(err);
            });
        });
    }

    private getBlobsContinuation(container: string, continuationToken: common.ContinuationToken, currentBlobDict: Dictionary<BlobInfo>): Promise<IOperationResultWithData<Dictionary<BlobInfo>>> {
        return new Promise<IOperationResultWithData<Dictionary<BlobInfo>>>((resolve: (val: IOperationResultWithData<Dictionary<BlobInfo>>) => void, reject: (reason: any) => void) => {
            this.blobService.listBlobsSegmented(container, continuationToken, (err: Error, result: BlobService.ListBlobsResult, response: ServiceResponse) => {
                if (err !== undefined && err !== null) {
                    reject(err);
    
                    return;
                }

                for (let blobResult of result.entries) {
                    let blobInfo: BlobInfo = new BlobInfo();
                    blobInfo.name = blobResult.name;
                    blobInfo.containerName = container;
                    blobInfo.contentLength = blobResult.contentLength;
                    blobInfo.creationTime = new Date(blobResult.creationTime);
                    blobInfo.deleted = blobResult.deleted;
                    blobInfo.deletedTime = new Date(blobResult.deletedTime);
                    blobInfo.lastModifiedTime = new Date(blobResult.lastModified);
                    
                    currentBlobDict[blobResult.name] = blobInfo;
                }

                if (result.continuationToken !== undefined && result.continuationToken !== null) {
                    this.getBlobsContinuation(container, result.continuationToken, currentBlobDict).then((cRes: IOperationResultWithData<Dictionary<BlobInfo>>) => {
                        resolve(cRes);
                    }).catch((cErr: any) => {
                        reject(cErr);
                    });
                } else {
                    let returnResult: AzureBlobOperationResult<Dictionary<BlobInfo>> = new AzureBlobOperationResult<Dictionary<BlobInfo>>();
                    returnResult.data = currentBlobDict;
                    returnResult.status = OperationResultStatus.success;

                    resolve(returnResult);
                }
            });
        });
    }
}
