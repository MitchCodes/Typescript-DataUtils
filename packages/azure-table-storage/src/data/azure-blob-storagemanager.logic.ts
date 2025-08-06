// Azure Blob Storage SDK imports
import { BlobServiceClient, StorageSharedKeyCredential, ContainerClient, BlockBlobClient, BlobDownloadResponseParsed } from '@azure/storage-blob';
import * as fs from 'fs';

// Azure Blob Storage options interfaces
namespace BlobService {
    export interface CreateContainerOptions {
        publicAccessLevel?: string;
        metadata?: { [key: string]: string };
    }
    export interface ContainerResult {
        name: string;
        created: boolean;
    }
    export interface BlobResult {
        name: string;
        container: string;
        contentLength?: number;
        contentSettings?: {
            contentEncoding?: string;
            contentType?: string;
        };
        creationTime?: string | Date;
        deleted?: boolean;
        deletedTime?: string | Date;
        lastModified?: string | Date;
    }
    export interface CreateBlockBlobRequestOptions {
        metadata?: { [key: string]: string };
        contentType?: string;
    }
    export interface GetBlobRequestOptions {
        metadata?: { [key: string]: string };
        rangeStart?: number;
        rangeEnd?: number;
    }
    export interface ListBlobsResult {
        entries: BlobResult[];
        continuationToken?: any;
    }
}

interface ServiceResponse {
    statusCode: number;
    headers: { [key: string]: string };
}

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
    private blobServiceClient: BlobServiceClient = null;
    private azureStorageAccount: string = '';
    private azureStorageKey: string = '';

    /**
     * Constructor.
     * @param azureStorageAccount The storage account name or connection string.
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
        if (this.azureStorageAccount.includes('DefaultEndpointsProtocol') || this.azureStorageAccount.includes('AccountName')) {
            // Connection string provided
            this.blobServiceClient = BlobServiceClient.fromConnectionString(this.azureStorageAccount);
        } else {
            // Account name and key provided
            const credential = new StorageSharedKeyCredential(this.azureStorageAccount, this.azureStorageKey);
            this.blobServiceClient = new BlobServiceClient(
                `https://${this.azureStorageAccount}.blob.core.windows.net`,
                credential
            );
        }
    }

    public async createContainerIfNotExists(containerName: string, containerOptions: BlobService.CreateContainerOptions = {}): Promise<IOperationResult> {
        try {
            const containerClient = this.blobServiceClient.getContainerClient(containerName);
            const createOptions: any = {
                access: containerOptions.publicAccessLevel || 'private',
                metadata: containerOptions.metadata
            };
            
            await containerClient.createIfNotExists(createOptions);
            
            let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
            promiseResult.status = OperationResultStatus.success;
            return promiseResult;
        } catch (error) {
            return AzureBlobOperationResult.buildSimpleError('Failed to create container', error as Error);
        }
    }

    public async deleteContainerIfExists(container: string): Promise<IOperationResult> {
        try {
            const containerClient = this.blobServiceClient.getContainerClient(container);
            await containerClient.deleteIfExists();
            
            let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
            promiseResult.status = OperationResultStatus.success;
            return promiseResult;
        } catch (error) {
            return AzureBlobOperationResult.buildSimpleError('Failed to delete container', error as Error);
        }
    }

    public async createBlobFromFile(container: string, blob: string, filePath: string, options: BlobService.CreateBlockBlobRequestOptions = {}): Promise<IOperationResult> {
        try {
            const containerClient = this.blobServiceClient.getContainerClient(container);
            const blockBlobClient = containerClient.getBlockBlobClient(blob);
            
            const uploadOptions: any = {
                blobHTTPHeaders: {
                    blobContentType: options.contentType
                },
                metadata: options.metadata
            };
            
            await blockBlobClient.uploadFile(filePath, uploadOptions);
            
            let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
            promiseResult.status = OperationResultStatus.success;
            return promiseResult;
        } catch (error) {
            return AzureBlobOperationResult.buildSimpleError('Failed to upload blob from file', error as Error);
        }
    }

    public async createBlobWritingStream(container: string, blob: string, options: BlobService.CreateBlockBlobRequestOptions = {}): Promise<IOperationResultWithData<Writable>> {
        try {
            const containerClient = this.blobServiceClient.getContainerClient(container);
            const blockBlobClient = containerClient.getBlockBlobClient(blob);
            
            // For the new Azure SDK, we need to create a PassThrough stream that will upload when ended
            const { PassThrough } = require('stream');
            const uploadStream = new PassThrough();
            
            // Start the upload in the background
            const uploadPromise = blockBlobClient.uploadStream(uploadStream, undefined, undefined, {
                blobHTTPHeaders: {
                    blobContentType: options.contentType
                },
                metadata: options.metadata
            });
            
            // Handle errors from the upload promise
            uploadPromise.catch((error) => {
                uploadStream.destroy(error);
            });
            
            let promiseResult: AzureBlobOperationResult<Writable> = new AzureBlobOperationResult();
            promiseResult.status = OperationResultStatus.success;
            promiseResult.data = uploadStream;
            return promiseResult;
        } catch (error) {
            return AzureBlobOperationResult.buildSimpleError('Failed to create blob writing stream', error as Error) as any;
        }
    }

    public async getBlobToFile(container: string, blob: string, outputFilePath: string, options: BlobService.GetBlobRequestOptions = {}): Promise<IOperationResult> {
        try {
            const containerClient = this.blobServiceClient.getContainerClient(container);
            const blockBlobClient = containerClient.getBlockBlobClient(blob);
            
            await blockBlobClient.downloadToFile(outputFilePath);
            
            let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
            promiseResult.status = OperationResultStatus.success;
            return promiseResult;
        } catch (error) {
            return AzureBlobOperationResult.buildSimpleError('Failed to download blob to file', error as Error);
        }
    }

    public async getBlobToStream(container: string, blob: string, stream: Writable, options: BlobService.GetBlobRequestOptions = {}): Promise<IOperationResultWithData<BlobInfo>> {
        try {
            const containerClient = this.blobServiceClient.getContainerClient(container);
            const blockBlobClient = containerClient.getBlockBlobClient(blob);
            
            const downloadResponse: BlobDownloadResponseParsed = await blockBlobClient.download();
            
            // Pipe the downloaded stream to the provided writable stream
            if (downloadResponse.readableStreamBody) {
                downloadResponse.readableStreamBody.pipe(stream);
            }
            
            let promiseResult: AzureBlobOperationResult<BlobInfo> = new AzureBlobOperationResult<BlobInfo>();
            promiseResult.status = OperationResultStatus.success;

            let blobInfo: BlobInfo = new BlobInfo();
            blobInfo.contentLength = downloadResponse.contentLength ? downloadResponse.contentLength.toString() : '0';
            blobInfo.containerName = container;
            blobInfo.contentEncoding = downloadResponse.contentEncoding || '';
            blobInfo.contentType = downloadResponse.contentType || '';
            blobInfo.creationTime = downloadResponse.createdOn || new Date();
            blobInfo.deleted = false; // Downloaded blobs are not deleted
            blobInfo.lastModifiedTime = downloadResponse.lastModified || new Date();
            blobInfo.name = blob;

            promiseResult.data = blobInfo;
            return promiseResult;
        } catch (error) {
            return AzureBlobOperationResult.buildSimpleError('Failed to download blob to stream', error as Error) as any;
        }
    }

    public async deleteBlobIfExists(container: string, blob: string): Promise<IOperationResult> {
        try {
            const containerClient = this.blobServiceClient.getContainerClient(container);
            const blockBlobClient = containerClient.getBlockBlobClient(blob);
            
            await blockBlobClient.deleteIfExists();
            
            let promiseResult: AzureBlobOperationResult<any> = new AzureBlobOperationResult();
            promiseResult.status = OperationResultStatus.success;
            return promiseResult;
        } catch (error) {
            return AzureBlobOperationResult.buildSimpleError('Failed to delete blob', error as Error);
        }
    }

    public async getBlobs(container: string): Promise<IOperationResultWithData<Dictionary<BlobInfo>>> {
        try {
            const containerClient = this.blobServiceClient.getContainerClient(container);
            let returnDict: Dictionary<BlobInfo> = {};
            
            // List all blobs using the async iterator
            for await (const blob of containerClient.listBlobsFlat()) {
                let blobInfo: BlobInfo = new BlobInfo();
                blobInfo.name = blob.name;
                blobInfo.containerName = container;
                blobInfo.contentLength = blob.properties.contentLength ? blob.properties.contentLength.toString() : '0';
                blobInfo.creationTime = blob.properties.createdOn || new Date();
                blobInfo.deleted = blob.deleted || false;
                blobInfo.deletedTime = blob.properties.deletedOn;
                blobInfo.lastModifiedTime = blob.properties.lastModified || new Date();
                blobInfo.contentType = blob.properties.contentType || '';
                blobInfo.contentEncoding = blob.properties.contentEncoding || '';
                
                returnDict[blob.name] = blobInfo;
            }
            
            let returnResult: AzureBlobOperationResult<Dictionary<BlobInfo>> = new AzureBlobOperationResult<Dictionary<BlobInfo>>();
            returnResult.data = returnDict;
            returnResult.status = OperationResultStatus.success;
            return returnResult;
        } catch (error) {
            return AzureBlobOperationResult.buildSimpleError('Failed to list blobs', error as Error) as any;
        }
    }

    // This method is no longer needed as the new SDK handles pagination automatically
}
