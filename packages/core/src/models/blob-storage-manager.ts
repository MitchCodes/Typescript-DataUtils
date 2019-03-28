import { IOperationResult } from './operation-result';
import { Readable, Writable } from 'stream';

export interface IBlobStorageManager {
    initializeConnection(): void;
    createContainerIfNotExists(containerName: string): Promise<IOperationResult>;
    createBlobFromFile(container: string, blob: string, filePath: string): Promise<IOperationResult>;
    createBlobFromStream(container: string, blob: string, stream: Readable, streamLength: number): Promise<IOperationResult>;
    getBlobToFile(container: string, blob: string, outputFilePath: string): Promise<IOperationResult>;
    getBlobToStream(container: string, blob: string, stream: Writable): Promise<IOperationResult>;
    deleteBlobIfExists(container: string, blob: string): Promise<IOperationResult>;
}
