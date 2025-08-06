import { IOperationResult, IOperationResultWithData } from './operation-result';
import { Readable, Writable } from 'stream';
import { Dictionary } from './dictionary';
import { BlobInfo } from './blob-info';
import { BlobResult } from './blob-result';

export interface IBlobStorageManager {
    initializeConnection(): void;
    createContainerIfNotExists(containerName: string): Promise<IOperationResult>;
    deleteContainerIfExists(container: string): Promise<IOperationResult>;
    createBlobFromFile(container: string, blob: string, filePath: string): Promise<IOperationResult>;
    createBlobWritingStream(container: string, blob: string): Promise<IOperationResultWithData<Writable>>;
    getBlobToFile(container: string, blob: string, outputFilePath: string): Promise<IOperationResult>;
    getBlobToStream(container: string, blob: string): Promise<IOperationResultWithData<BlobResult>>;
    writeBlobToStream(container: string, blob: string, stream: Writable): Promise<IOperationResultWithData<BlobInfo>>;
    deleteBlobIfExists(container: string, blob: string): Promise<IOperationResult>;
    getBlobs(container: string): Promise<IOperationResultWithData<Dictionary<BlobInfo>>>;
}
