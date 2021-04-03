import { Provider } from 'nconf';
import { ILogger, IOperationResult, IOperationResultWithData, OperationResultStatus } from 'tsdatautils-core';
import { TableStorageObjectConverter } from '../models/table-storage-object-converter';
import { AzureDocumentResult, AzureDocumentStorageManager, IAzureDocumentSavable } from './azure-document-storagemanager.logic';

// tslint:disable:max-line-length align
export class GenericTableDocumentDataService<T extends IAzureDocumentSavable> {

    protected configProvider: Provider;
    protected logger: ILogger;
    protected azureStorageManager: AzureDocumentStorageManager<T>;
    protected azureTable: string = '';
    protected partitionKey: string = '';

    public constructor(configProvider: Provider = null, logger: ILogger = null, type: new () => T = null, azureAcct: string = null, azureKey: string = null, azureTable: string = null, azureTablePartitionKey: string = null, converters: TableStorageObjectConverter[] = []) {
        this.configProvider = configProvider;
        this.logger = logger;
        this.azureTable = azureTable;
        this.partitionKey = azureTablePartitionKey;

        if (type && azureAcct && azureKey && azureTable && azureTablePartitionKey) {
            this.azureStorageManager = new AzureDocumentStorageManager<T>(type, azureAcct, azureKey, converters);
            this.azureStorageManager.initializeConnection();
        }
    }

    protected processEntityBeforeSave(entity: T): void {

    }

    protected processLoadedEntity(entity: T): void {

    }

    public async getAllInPartition(): Promise<T[]> {
        try {
            let res: AzureDocumentResult<T> = await this.azureStorageManager.getByPartitionKey(this.azureTable, this.partitionKey);
            if (res.status === OperationResultStatus.success) {
                if (res.data.length === 0) {
                    return [];
                } else {
                    for (let entity of res.data) {
                        this.processLoadedEntity(entity);
                    }
                    return res.data;
                }
            } else {
                this.logger.error('Error looking up data for partition ' + this.partitionKey + ': ' + res.message);
                return null;
            }
        } catch (err) {
            let errorMessage: string = err;
            this.logger.error('Could not get documents: ' + errorMessage);
            return null;
        }
    }

    public async getForPartitionAndRow(rowKey: string, noDataResolver: () => T = null): Promise<T> {
        try {
            let res: AzureDocumentResult<T> = await this.azureStorageManager.getByPartitionAndRowKey(this.azureTable, this.partitionKey, rowKey);
            if (res.status === OperationResultStatus.success) {
                if (res.data.length === 0) {
                    if (noDataResolver === null) {
                        return null;
                    } else {
                        return noDataResolver();
                    }
                } else if (res.data.length > 1) {
                    this.logger.error('Error looking up data for partition ' + 
                                        this.partitionKey + ' and row ' + rowKey + ': Too much data found. Some kind of error?');
                    return null;
                } else {
                    let entity: T = res.data[0];
                    this.processLoadedEntity(entity);
                    return entity;
                }
            } else {
                this.logger.error('Error looking up data for partition ' + this.partitionKey + ' and row ' + rowKey + ': ' + res.message);
                return null;
            }
        } catch (err) {
            let errorMessage: string = err;
            this.logger.error('Could not get documents: ' + errorMessage);
            return null;
        }
    }

    public async save(entity: T): Promise<AzureDocumentResult<T>> {
        entity.partitionKey = this.partitionKey;

        try {
            this.processEntityBeforeSave(entity);
            let saveResult: IOperationResult = await this.azureStorageManager.save(this.azureTable, entity);

            let newResult: AzureDocumentResult<T> = new AzureDocumentResult<T>();
            newResult.status = saveResult.status;
            newResult.message = saveResult.message;
            newResult.error = saveResult.error;

            return newResult;
        } catch (err) {
            return err;
        }
    }

    public async remove(entity: T): Promise<AzureDocumentResult<T>> {
        entity.partitionKey = this.partitionKey;

        try {
            let removeResult: AzureDocumentResult<T> = await this.azureStorageManager.remove(this.azureTable, entity);
            return removeResult;
        } catch (err) {
            return err;
        }
    }

}