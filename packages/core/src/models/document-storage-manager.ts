import { IOperationResult } from './operation-result';
import { IBatchResults } from './batch-result';
import * as moment from 'moment';

export interface IDocumentStorageManager {
    initializeConnection(): void;
    createTableIfNotExists(tableName: string): Promise<IOperationResult>;
    save(tableName: string, input: any): Promise<IOperationResult>;
    saveMany(tableName: string, input: any[]): Promise<IBatchResults>;
    getByPartitionAndRowKey(tableName: string, partitionKey: string, rowKey: string): Promise<IOperationResult>;
    getByPartitionKey(tableName: string, partitionKey: string): Promise<IOperationResult>;
    remove(tableName: string, objToRemove: any): Promise<IOperationResult>;
    removeMany(tableName: string, input: any[]): Promise<IBatchResults>;
}
