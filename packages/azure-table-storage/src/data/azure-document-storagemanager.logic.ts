import { TableService, ErrorOrResult, TableUtilities, ExponentialRetryPolicyFilter, 
    createTableService, TableQuery, TableBatch } from 'azure-storage';
import * as moment from 'moment';
import { DocumentIdentifier, IOperationResult, OperationResultStatus, Dictionary, IDocumentStorageManager, BatchResultStatus, IBatchResult, IBatchResults, ITableCache, BasicDocumentIdentifier } from 'tsdatautils-core';

export interface IAzureDocumentSavable {
    partitionKey: string;
    rowKey: string;
    classVersion: number;
    handleVersionChange(inputObject: Object, inputVersion: number, latestVersion: number): boolean;
}

export class AzureDocumentResult<T extends IAzureDocumentSavable> implements IOperationResult {
    public status: OperationResultStatus;
    public error: Error;
    public message: string;
    public data: T[];

    public constructor() {
        this.status = OperationResultStatus.pending;
        this.data = [];
    }

    // tslint:disable-next-line:function-name
    public static buildSimpleError<T extends IAzureDocumentSavable>(errorString: string, errorObj: Error = null): AzureDocumentResult<T> {
        let azureRes: AzureDocumentResult<T> = new this();
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

export interface IAzureDocumentBatch {
    currentBatch: TableBatch;
    totalBatches: TableBatch[];
    tblService: TableService;
    tableName: string;
    partitionName: string;
}

export class AzureDocumentBatch implements IAzureDocumentBatch {
    public currentBatch: TableBatch;
    public totalBatches: TableBatch[];
    public tblService: TableService;
    public tableName: string;
    public partitionName: string = null;

    public constructor() {
        this.totalBatches = [];
    }
}

export class AzureDocumentBatchResult implements IBatchResult {
    public batch: TableBatch;
    public result: IOperationResult;
}

// tslint:disable-next-line:max-classes-per-file
export class AzureDocumentBatchResults implements IBatchResults {
    public results: AzureDocumentBatchResult[];
    public overallStatus: BatchResultStatus;

    public constructor() {
        this.results = [];
    }

    public getFailedTableBatches(): TableBatch[] {
        let returnCol: TableBatch[] = [];

        for (let res of this.results) {
            if (res.result.status === OperationResultStatus.error) {
                returnCol.push(res.batch);
            }
        }

        return returnCol;
    }
}

export enum AzureDocumentBatchType {
    instance = 0,
    global = 1,
}

// tslint:disable-next-line:max-classes-per-file
export class AzureDocumentStorageManager<T extends IAzureDocumentSavable> implements IDocumentStorageManager {
    private static globalBatches: Dictionary<IAzureDocumentBatch> = {};
    private static globalCache: Dictionary<any> = {};
    private tblService: TableService = null;
    private azureStorageAccount: string = '';
    private azureStorageKey: string = '';
    private overrideTableService: TableService = null;
    private testType: new () => T;
    private instanceBatches: Dictionary<IAzureDocumentBatch> = {};
    private maxBatchNumber: number = 50;
    private cache: IAzureDocumentCache<T> = null;

    public constructor(testType: new () => T, azureStorageAccount: string = '', 
                       azureStorageKey: string = '', overrideTableService: TableService = null) {
        this.testType = testType;
        this.azureStorageAccount = azureStorageAccount;
        this.azureStorageKey = azureStorageKey;
        this.overrideTableService = overrideTableService;

        if (overrideTableService !== null) {
            this.tblService = overrideTableService;
        }

        let typeName: string = this.getTypeName();
        let azureCacheAny: any = AzureDocumentStorageManager.globalCache[typeName];
        if (azureCacheAny !== undefined && azureCacheAny !== null) {
            this.cache = <IAzureDocumentCache<T>>azureCacheAny;
        } else {
            let newCache: IAzureDocumentCache<T> = new AzureTableDocumentCacheInMemory<T>();
            AzureDocumentStorageManager.globalCache[typeName] = newCache;
            this.cache = newCache;
        }
    }

    public initializeConnection(): void {
        if (this.overrideTableService === null) {
            let retryFilter: ExponentialRetryPolicyFilter = new ExponentialRetryPolicyFilter(0, 300, 300, 10000);
            if (this.azureStorageAccount !== '' && this.azureStorageKey !== '') {
                this.tblService = new TableService(this.azureStorageAccount, this.azureStorageKey).withFilter(retryFilter);
            } else if (this.azureStorageAccount !== '') {
                this.tblService = new TableService(this.azureStorageAccount).withFilter(retryFilter);
            } else {
                this.tblService = new TableService().withFilter(retryFilter);
            }
        }
    }

    public createTableIfNotExists(tableName: string): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve : (val: IOperationResult) => void, reject : (val: IOperationResult) => void) => {
            let result: AzureDocumentResult<T> = new AzureDocumentResult<T>();
            if (this.tblService !== null) {
                this.tblService.createTableIfNotExists(tableName, (createError: any, createResult: any, createResponse: any) => {
                    if (!createError) {
                        result.status = OperationResultStatus.success;
                        result.message = 'Succesfully created table if it does not exist.';
                        resolve(result);
                    } else {
                        result.error = new Error('Error creating table ' + tableName + ': ' + createError);
                        result.message = 'Error creating table ' + tableName + ': ' + createError;
                        reject(result);
                    }
                });
            } else {
                result.status = OperationResultStatus.error;
                result.message = 'Table service was null';
                result.error = new Error('Table service was null');
                reject(result);
            }
        });
    }

    public save(tableName: string, input: T): Promise<IOperationResult> {
        return this.insertOrReplaceObj(tableName, input);
    }

    public saveMany(tableName: string, input: T[]): Promise<AzureDocumentBatchResults> {
        return new Promise<AzureDocumentBatchResults>((resolve : (val: AzureDocumentBatchResults) => void, reject : (val: AzureDocumentBatchResults) => void) => {
            let batchId: string = this.newGuid();
            this.createBatch(batchId, tableName, AzureDocumentBatchType.instance);
            for (let curObj of input) {
                this.addBatchSave(batchId, curObj, AzureDocumentBatchType.instance);
            }
            this.executeBatch(batchId, AzureDocumentBatchType.instance).then((res: AzureDocumentBatchResults) => {
                resolve(res);
            }).catch((err: AzureDocumentBatchResults) => {
                reject(err);
            });
        });
    }

    public getByPartitionAndRowKey(tableName: string, partitionKey: string, rowKey: string, 
                                   useCache: boolean = false, 
                                   cacheDuration: moment.Duration = moment.duration(3, 'hours')): Promise<AzureDocumentResult<T>> {
        return new Promise<AzureDocumentResult<T>>((resolve : (val: AzureDocumentResult<T>) => void, reject : (val: AzureDocumentResult<T>) => void) => {
            let runQuery: boolean = true;
            let tableQuery: TableQuery = new TableQuery().where('PartitionKey eq ?', partitionKey).and('RowKey eq ?', rowKey);
            if (useCache) {
                let cachedItem: T = this.cache.getItem(tableName, new AzureDocumentIdentifier(partitionKey, rowKey));
                if (cachedItem !== null) {
                    runQuery = false;
                    let result: AzureDocumentResult<T> = new AzureDocumentResult<T>();
                    result.status = OperationResultStatus.success;
                    result.message = 'Got data from cache.';
                    result.data.push(cachedItem);
                    resolve(result);
                }
            }
            if (runQuery) {
                this.executeQuery(tableName, tableQuery).then((success: AzureDocumentResult<T>) => {
                    if (useCache && success.data.length === 1) {
                        this.cache.setItem(tableName, success.data[0], cacheDuration);
                    }
                    resolve(success);
                }).catch((err: AzureDocumentResult<T>) => {
                    reject(err);
                });
            }
        });
    }

    public getByPartitionKey(tableName: string, partitionKey: string,
                             useCache: boolean = false, 
                             cacheDuration: moment.Duration = moment.duration(3, 'hours')): Promise<AzureDocumentResult<T>> {
        return new Promise<AzureDocumentResult<T>>((resolve : (val: AzureDocumentResult<T>) => void, reject : (val: AzureDocumentResult<T>) => void) => {
            let runQuery: boolean = true;
            let tableQuery: TableQuery = new TableQuery().where('PartitionKey eq ?', partitionKey);
            if (useCache) {
                let cachedItems: T[] = this.cache.getItemsByQuery(tableName, tableQuery);
                if (cachedItems !== null) {
                    runQuery = false;
                    let result: AzureDocumentResult<T> = new AzureDocumentResult<T>();
                    result.status = OperationResultStatus.success;
                    result.message = 'Got data from cache.';
                    for (let cachedItem of cachedItems) {
                        result.data.push(cachedItem);
                    }
                    resolve(result);
                }
            }
            if (runQuery) {
                this.executeQuery(tableName, tableQuery).then((success: AzureDocumentResult<T>) => {
                    if (useCache) {
                        this.cache.setItemsByQuery(tableName, success.data, tableQuery, cacheDuration);
                    }
                    resolve(success);
                }).catch((err: AzureDocumentResult<T>) => {
                    reject(err);
                });
            }
        });
    }

    public getByQuery(tableName: string, query: TableQuery,
                      useCache: boolean = false, 
                      cacheDuration: moment.Duration = moment.duration(3, 'hours')): Promise<AzureDocumentResult<T>> {
        return new Promise<AzureDocumentResult<T>>((resolve : (val: AzureDocumentResult<T>) => void, reject : (val: AzureDocumentResult<T>) => void) => {
            let runQuery: boolean = true;
            if (useCache) {
                let cachedItems: T[] = this.cache.getItemsByQuery(tableName, query);
                if (cachedItems !== null) {
                    runQuery = false;
                    let result: AzureDocumentResult<T> = new AzureDocumentResult<T>();
                    result.status = OperationResultStatus.success;
                    result.message = 'Got data from cache.';
                    for (let cachedItem of cachedItems) {
                        result.data.push(cachedItem);
                    }
                    resolve(result);
                }
            }
            if (runQuery) {
                this.executeQuery(tableName, query).then((success: AzureDocumentResult<T>) => {
                    if (useCache) {
                        this.cache.setItemsByQuery(tableName, success.data, query, cacheDuration);
                    }
                    resolve(success);
                }).catch((err: AzureDocumentResult<T>) => {
                    reject(err);
                });
            }
        });
    }

    public remove(tableName: string, objToRemove: T): Promise<AzureDocumentResult<T>> {
        return new Promise<AzureDocumentResult<T>>((resolve : (val: AzureDocumentResult<T>) => void, reject : (val: AzureDocumentResult<T>) => void) => {
            this.removeObj(tableName, objToRemove).then((success: AzureDocumentResult<T>) => {
                resolve(success);
            }).catch((err: AzureDocumentResult<T>) => {
                reject(err);
            });
        });
    }

    public removeMany(tableName: string, input: T[]): Promise<AzureDocumentBatchResults> {
        return new Promise<AzureDocumentBatchResults>((resolve : (val: AzureDocumentBatchResults) => void, reject : (val: AzureDocumentBatchResults) => void) => {
            let batchId: string = this.newGuid();
            this.createBatch(batchId, tableName, AzureDocumentBatchType.instance);
            for (let curObj of input) {
                this.addBatchRemove(batchId, curObj, AzureDocumentBatchType.instance);
            }
            this.executeBatch(batchId, AzureDocumentBatchType.instance).then((res: AzureDocumentBatchResults) => {
                resolve(res);
            }).catch((err: AzureDocumentBatchResults) => {
                reject(err);
            });
        });
    }

    public removeByQuery(tableName: string, query: TableQuery): Promise<AzureDocumentBatchResults> {
        return new Promise<AzureDocumentBatchResults>((resolve : (val: AzureDocumentBatchResults) => void, reject : (val: AzureDocumentBatchResults) => void) => {
            let result: AzureDocumentBatchResults = new AzureDocumentBatchResults();
            this.getByQuery(tableName, query).then((dataQuerySuccess: AzureDocumentResult<T>) => {
                if (dataQuerySuccess.data.length > 0) {
                    this.removeMany(tableName, dataQuerySuccess.data).then((dataRemoveSuccess: AzureDocumentBatchResults) => {
                        resolve(dataRemoveSuccess);
                    }).catch((dataRemoveErr: AzureDocumentBatchResults) => {
                        reject(dataRemoveErr);
                    });
                } else {
                    result.overallStatus = BatchResultStatus.allSuccess;
                    resolve(result);
                }
            }).catch((dataQueryErr: AzureDocumentResult<T>) => {
                let azureBatchResult: AzureDocumentBatchResult = new AzureDocumentBatchResult();
                azureBatchResult.result = dataQueryErr;
                result.results.push(azureBatchResult);
                result.overallStatus = BatchResultStatus.allError;
                reject(result);
            });
        });
    }

    public addBatchRemove(batchName: string, obj: T, batchType: AzureDocumentBatchType = AzureDocumentBatchType.instance): AzureDocumentResult<any> {
        return this.removeObjBatch(batchName, obj, batchType);
    }    

    public createBatch(batchName: string, tableName: string, batchType: AzureDocumentBatchType = AzureDocumentBatchType.instance): void {
        switch (batchType) {
            case AzureDocumentBatchType.global:
                let newAzureGlobalBatch: AzureDocumentBatch = new AzureDocumentBatch();
                newAzureGlobalBatch.currentBatch = new TableBatch();
                newAzureGlobalBatch.tblService = this.tblService;
                newAzureGlobalBatch.tableName = tableName;
                AzureDocumentStorageManager.globalBatches[batchName] = newAzureGlobalBatch;
                break;
            case AzureDocumentBatchType.instance:
                let newAzureInstanceBatch: AzureDocumentBatch = new AzureDocumentBatch();
                newAzureInstanceBatch.currentBatch = new TableBatch();
                newAzureInstanceBatch.tblService = this.tblService;
                newAzureInstanceBatch.tableName = tableName;
                this.instanceBatches[batchName] = newAzureInstanceBatch;
                break;
            default:
        }
    }

    public executeBatch(batchName: string, batchType: AzureDocumentBatchType = AzureDocumentBatchType.instance): Promise<AzureDocumentBatchResults> {
        return new Promise<AzureDocumentBatchResults>((resolve : (val: AzureDocumentBatchResults) => void, reject : (val: AzureDocumentBatchResults) => void) => {
            let azureBatch: AzureDocumentBatch = null;
            switch (batchType) {
                case AzureDocumentBatchType.global:
                    let azureGlobalBatch: AzureDocumentBatch = AzureDocumentStorageManager.globalBatches[batchName];
                    azureBatch = azureGlobalBatch;
                    break;
                case AzureDocumentBatchType.instance:
                    let azureInstanceBatch: AzureDocumentBatch = this.instanceBatches[batchName];
                    azureBatch = azureInstanceBatch;
                    break;
                default:
            }

            if (azureBatch !== null) {
                azureBatch.totalBatches.push(azureBatch.currentBatch);
                let newTableBatchesCol: TableBatch[] = [];
                for (let curBatch of azureBatch.totalBatches) {
                    newTableBatchesCol.push(curBatch);
                }
                this.executeBatches(newTableBatchesCol, azureBatch.tblService, 
                                    azureBatch.tableName, null).then((res: AzureDocumentBatchResults) => {
                    resolve(res);
                });
            } else {
                let nullBatchOrTblServResult: AzureDocumentBatchResults = new AzureDocumentBatchResults();
                nullBatchOrTblServResult.overallStatus = BatchResultStatus.allError;
                reject(nullBatchOrTblServResult);
            }
        });
    }

    public addBatchSave(batchName: string, obj: T, batchType: AzureDocumentBatchType = AzureDocumentBatchType.instance): AzureDocumentResult<any> {
        return this.insertOrReplaceObjBatch(batchName, obj, batchType);
    }

    private getCurrentBatch(batchName: string, batchType: AzureDocumentBatchType = AzureDocumentBatchType.instance): AzureDocumentBatch {
        switch (batchType) {
            case AzureDocumentBatchType.global:
                let azureGlobalBatch: AzureDocumentBatch = AzureDocumentStorageManager.globalBatches[batchName];
                if (azureGlobalBatch !== undefined && azureGlobalBatch !== null) {
                    return azureGlobalBatch;
                } else {
                    return null;
                }
            case AzureDocumentBatchType.instance:
                let azureInstanceBatch: AzureDocumentBatch = this.instanceBatches[batchName];
                if (azureInstanceBatch !== undefined && azureInstanceBatch !== null) {
                    return azureInstanceBatch;
                } else {
                    return null;
                }
            default:
                return null;
        }
    }

    private removeBatch(batchName: string, batchType: AzureDocumentBatchType = AzureDocumentBatchType.instance): void {
        switch (batchType) {
            case AzureDocumentBatchType.global:
                AzureDocumentStorageManager.globalBatches[batchName] = undefined;
                break;
            case AzureDocumentBatchType.instance:
                this.instanceBatches[batchName] = undefined;
                break;
            default:
        }
    }

    private executeQuery(tableName: string, tableQuery: TableQuery): Promise<AzureDocumentResult<T>> {
        return new Promise<AzureDocumentResult<T>>((resolve : (val: AzureDocumentResult<T>) => void, reject : (val: AzureDocumentResult<T>) => void) => {
            this.executeQueryContinuation(tableName, tableQuery, [], null).then((success: AzureDocumentResult<T>) => {
                resolve(success);
            }).catch((err: AzureDocumentResult<T>) => {
                reject(err);
            });
        });
    }

    private executeQueryContinuation(tableName: string, tableQuery: TableQuery, 
                                     dataArray: T[], contToken: TableService.TableContinuationToken): Promise<AzureDocumentResult<T>> {
        return new Promise<AzureDocumentResult<T>>((resolve : (val: AzureDocumentResult<T>) => void, reject : (val: AzureDocumentResult<T>) => void) => {
            if (this.tblService === undefined || this.tblService === null) {
                let tblServiceNullResult: AzureDocumentResult<T> = new AzureDocumentResult<T>();
                tblServiceNullResult.status = OperationResultStatus.error;
                tblServiceNullResult.error = new Error('Table service is not defined for querying');
                tblServiceNullResult.message = 'Table service is not defined for querying';
                reject(tblServiceNullResult);
            }
            this.tblService.queryEntities(tableName, tableQuery, contToken, (error: any, result: any, response: any) => {
                if (!error) {
                    for (let entry of result.entries) {
                        let normalObject: Object = this.convertFromAzureObjToObject(entry);
                        this.updateModel(normalObject); // update the model for migration purposes
                        dataArray.push(this.convertFromObjToType(normalObject));
                    }
                    if (result.continuationToken !== null) {
                        // tslint:disable-next-line:max-line-length
                        this.executeQueryContinuation(tableName, tableQuery, dataArray, result.continuationToken).then((success: AzureDocumentResult<T>) => {
                            resolve(success);
                        }).catch((err: AzureDocumentResult<T>) => {
                            reject(err);
                        });
                    } else {
                        let finishDataResult: AzureDocumentResult<T> = new AzureDocumentResult<T>();
                        finishDataResult.status = OperationResultStatus.success;
                        finishDataResult.message = 'Successfully queried data';
                        finishDataResult.data = dataArray;
                        resolve(finishDataResult);
                    }
                } else {
                    let queryErrorResult: AzureDocumentResult<T> = new AzureDocumentResult<T>();
                    queryErrorResult.error = new Error(error);
                    queryErrorResult.message = error;
                    queryErrorResult.status = OperationResultStatus.error;
                    reject(queryErrorResult);
                }
            });
        });
    }

    private executeBatches(allBatches: TableBatch[], tblService: TableService, tableName: string, 
                           azureResult: AzureDocumentBatchResults): Promise<AzureDocumentBatchResults> {
        return new Promise<AzureDocumentBatchResults>((resolve : (val: AzureDocumentBatchResults) => void, reject : (val: AzureDocumentBatchResults) => void) => {
            if (tableName !== undefined && tableName !== null && tblService !== undefined 
                && tblService !== null && allBatches !== undefined && allBatches !== null) {

                if (allBatches.length === 0) {
                    let allError: boolean = true;
                    let allSuccess: boolean = true;
                    for (let curBatchRes of azureResult.results) {
                        if (curBatchRes.result.status === OperationResultStatus.error) {
                            allSuccess = false;
                        }
                        if (curBatchRes.result.status === OperationResultStatus.success) {
                            allError = false;
                        }
                    }
                    if (allError) {
                        azureResult.overallStatus = BatchResultStatus.allError;
                    } else if (allSuccess) {
                        azureResult.overallStatus = BatchResultStatus.allSuccess;
                    } else {
                        azureResult.overallStatus = BatchResultStatus.partialSuccess;
                    }
                    resolve(azureResult);
                }

                let currentBatch: TableBatch = allBatches.pop();
                tblService.executeBatch(tableName, currentBatch, (err: any, result: any, response: any) => {
                    let batchResult: AzureDocumentResult<any> = new AzureDocumentResult<any>();
                    let newAzureBatchResult: AzureDocumentBatchResult = new AzureDocumentBatchResult();
                    if (!err) {
                        batchResult.status = OperationResultStatus.success;
                        batchResult.message = 'Successfully executed batch';
                        batchResult.data = result;
                    } else {
                        batchResult.error = new Error(err);
                        batchResult.message = err;
                        batchResult.status = OperationResultStatus.error;
                    }
                    newAzureBatchResult.batch = currentBatch;
                    newAzureBatchResult.result = batchResult;
                    let passInAzureResults: AzureDocumentBatchResults = null;
                    if (azureResult !== null && azureResult !== undefined) {
                        passInAzureResults = azureResult;
                    } else {
                        passInAzureResults = new AzureDocumentBatchResults();
                    }
                    passInAzureResults.results.push(newAzureBatchResult);

                    this.executeBatches(allBatches, tblService, tableName, passInAzureResults).then((res: AzureDocumentBatchResults) => {
                        resolve(res);
                    });
                });
            }
        });
    }

    private updateModel(inputObject: Object): boolean {
        let newModel: T = this.getNew();
        let inputVersion: number = -1;
        // tslint:disable-next-line:no-string-literal
        if (inputObject['classVersion'] !== undefined && inputObject['classVersion'] !== null) {
            // tslint:disable-next-line:no-string-literal
            inputVersion = inputObject['classVersion'];
        }
        let updated: boolean = newModel.handleVersionChange(inputObject, inputVersion, newModel.classVersion);
        if (updated) {
            // tslint:disable-next-line:no-string-literal
            inputObject['classVersion'] = newModel.classVersion;
        }

        return updated;
    }

    private getNew(): T {
        return new this.testType();
    }

    private insertOrReplaceObj(tableName: string, obj: T): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve : (val: IOperationResult) => void, reject : (val: IOperationResult) => void) => {
            let azureResult: AzureDocumentResult<T> = new AzureDocumentResult<T>();
            azureResult.status = OperationResultStatus.executing;
            let azureObj = this.convertToAzureObj(obj);
            this.cache.invalidateCacheItem(tableName, AzureDocumentIdentifier.fromObj(obj));
            this.tblService.insertOrReplaceEntity(tableName, azureObj, {}, (error: any, result: any, response: any) => {
                if (error) {
                    azureResult.status = OperationResultStatus.error;
                    azureResult.message = 'Error inserting new entity: ' + error;
                    azureResult.error = new Error('Error inserting new entity: ' + error);
                    reject(azureResult);
                } else {
                    azureResult.status = OperationResultStatus.success;
                    resolve(azureResult);
                }
            });
        });
    }

    private insertOrReplaceObjBatch(batchName: string, obj: T, batchType: AzureDocumentBatchType = AzureDocumentBatchType.instance): AzureDocumentResult<any> { 
        let result: AzureDocumentResult<any> = new AzureDocumentResult<any>();
        let batch: AzureDocumentBatch = this.getCurrentBatch(batchName, batchType);
        if (batch !== undefined && batch !== null && batch.currentBatch !== undefined && batch.currentBatch !== null) {
            if (batch.partitionName === null) {
                batch.partitionName = obj.partitionKey;
            }
            if (batch.partitionName === obj.partitionKey) {
                let azureObj = this.convertToAzureObj(obj);
                if (batch.currentBatch.size() >= this.maxBatchNumber) {
                    batch.totalBatches.push(batch.currentBatch);
                    batch.currentBatch = new TableBatch();
                }
                batch.currentBatch.insertOrReplaceEntity(azureObj);
                this.cache.invalidateCacheItem(batch.tableName, AzureDocumentIdentifier.fromObj(obj));

                result.message = 'Successfully added insert/update to batch.';
                result.status = OperationResultStatus.success;
            } else {
                result.error = new Error('Partition key must match.');
                result.message = 'Partition key must match. Matching keys: ' + batch.partitionName + ' and ' + obj.partitionKey;
                result.status = OperationResultStatus.error;
            }            
        } else {
            result.error = new Error('Batch is undefined somehow.');
            result.message = 'Batch is undefined somehow.';
            result.status = OperationResultStatus.error;
        }

        return result;
    }

    private removeObj(tableName: string, obj: T): Promise<IOperationResult> {
        return new Promise<IOperationResult>((resolve : (val: IOperationResult) => void, reject : (val: IOperationResult) => void) => {
            let azureResult: AzureDocumentResult<T> = new AzureDocumentResult<T>();
            let azureObj = this.convertToAzureObjOnlyKeys(obj);
            this.cache.invalidateCacheItem(tableName, AzureDocumentIdentifier.fromObj(obj));
            this.tblService.deleteEntity(tableName, azureObj, {}, (error: any, response: any) => {
                if (error) {
                    azureResult.status = OperationResultStatus.error;
                    azureResult.message = 'Error deleting entity: ' + error;
                    azureResult.error = new Error('Error deleting entity: ' + error);
                    reject(azureResult);
                } else {
                    azureResult.status = OperationResultStatus.success;
                    resolve(azureResult);
                }
            });
        });
    }

    private removeObjBatch(batchName: string, obj: T, batchType: AzureDocumentBatchType = AzureDocumentBatchType.instance): AzureDocumentResult<any> {
        let result: AzureDocumentResult<any> = new AzureDocumentResult<any>();
        let batch: AzureDocumentBatch = this.getCurrentBatch(batchName, batchType);
        if (batch !== undefined && batch !== null && batch.currentBatch !== undefined && batch.currentBatch !== null) {
            if (batch.partitionName === null) {
                batch.partitionName = obj.partitionKey;
            }
            if (batch.partitionName === obj.partitionKey) {
                let azureObj = this.convertToAzureObjOnlyKeys(obj);
                if (batch.currentBatch.size() >= this.maxBatchNumber) {
                    batch.totalBatches.push(batch.currentBatch);
                    batch.currentBatch = new TableBatch();
                }
                batch.currentBatch.deleteEntity(azureObj);
                this.cache.invalidateCacheItem(batch.tableName, AzureDocumentIdentifier.fromObj(obj));

                result.message = 'Successfully added remove to batch.';
                result.status = OperationResultStatus.success;
            } else {
                result.error = new Error('Partition key must match.');
                result.message = 'Partition key must match. Matching keys: ' + batch.partitionName + ' and ' + obj.partitionKey;
                result.status = OperationResultStatus.error;
            }
        } else {
            result.error = new Error('Batch is undefined somehow.');
            result.message = 'Batch is undefined somehow.';
            result.status = OperationResultStatus.error;
        }

        return result;
    }

    private convertToAzureObj(obj: T): Object {
        let entGen = TableUtilities.entityGenerator;
        let returnObj: Object = {};
        let objectKeys: string[] = Object.keys(obj);
        // tslint:disable-next-line:no-string-literal
        returnObj['PartitionKey'] = entGen.String(obj.partitionKey);
        // tslint:disable-next-line:no-string-literal
        returnObj['RowKey'] = entGen.String(obj.rowKey);
        for (let key of objectKeys) {
            if (key === 'partitionKey' || key === 'rowKey') {
                continue;
            }
            let keyType = typeof obj[key];
            if (keyType === 'function' || keyType === 'symbol' || keyType === 'undefined') {
                continue;
            } else if (keyType === 'object') {
                if (obj[key] instanceof Date) {
                    returnObj[key] = entGen.DateTime(<Date>obj[key]);
                } else {
                    continue;
                }
            } else if (keyType === 'boolean') {
                returnObj[key] = entGen.Boolean(obj[key]);
            } else if (keyType === 'number') {
                if (Number.isSafeInteger(obj[key])) {
                    returnObj[key] = entGen.Int64(obj[key]);
                } else {
                    returnObj[key] = entGen.Double(obj[key]);
                }
            } else if (keyType === 'string') {
                returnObj[key] = entGen.String(obj[key]);
            } else {
                continue;
            }
        }    

        return returnObj;
    }

    private convertToAzureObjOnlyKeys(obj: T): Object {
        let entGen = TableUtilities.entityGenerator;
        let returnObj: Object = {};
        // tslint:disable-next-line:no-string-literal
        returnObj['PartitionKey'] = entGen.String(obj.partitionKey);
        // tslint:disable-next-line:no-string-literal
        returnObj['RowKey'] = entGen.String(obj.rowKey);

        return returnObj;
    }

    private convertFromAzureObjToObject(azureObj: Object): Object {
        let returnObj: Object = {};

        let azureObjectKeys: string[] = Object.keys(azureObj);

        // tslint:disable-next-line:no-string-literal
        returnObj['partitionKey'] = azureObj['PartitionKey']._;
        // tslint:disable-next-line:no-string-literal
        returnObj['rowKey'] = azureObj['RowKey']._;
        
        for (let key of azureObjectKeys) {
            if (key === 'PartitionKey' || key === 'RowKey') {
                continue;
            }

            let azureModel: any = azureObj[key];

            switch (azureModel.$) {
                case TableUtilities.EdmType.INT64:
                    returnObj[key] = Number(azureObj[key]._);
                    break;
                case TableUtilities.EdmType.INT32:
                    returnObj[key] = Number(azureObj[key]._);
                    break;
                case TableUtilities.EdmType.DOUBLE:
                    returnObj[key] = Number(azureObj[key]._);
                    break;
                case TableUtilities.EdmType.BOOLEAN:
                    returnObj[key] = Boolean(azureObj[key]._);
                    break;
                case TableUtilities.EdmType.DATETIME:
                    returnObj[key] = new Date(azureObj[key]._);
                    break;
                default:
                    returnObj[key] = azureObj[key]._;
            }
            
        }

        return returnObj;
    }

    private convertFromObjToType(obj: Object): T {
        let returnObj: T = this.getNew();

        let objectKeys: string[] = Object.keys(obj);
        
        for (let key of objectKeys) {
            returnObj[key] = obj[key];
        }

        return returnObj;
    }

    private newGuid(): string {
        return this.s4() + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + this.s4() + this.s4();
    }

    private s4() {
        // tslint:disable-next-line:insecure-random binary-expression-operand-order
        return Math.floor((1 + Math.random()) * 0x10000) .toString(16).substring(1);
    }

    // This may return a different name if the generic class is minified.
    private getTypeName(): string {
        let newObj: T = this.getNew();
        let constructCasted: any = newObj.constructor;

        return constructCasted.name;
    }

}

// tslint:disable-next-line:max-classes-per-file no-unnecessary-class
export class AzureDocumentIdentifier implements DocumentIdentifier {
    public partitionKey: string;
    public rowKey: string;

    get cacheKey(): string {
        return this.partitionKey + '_' + this.rowKey;
    }

    public constructor(partitionKey: string, rowKey: string) {
        this.partitionKey = partitionKey;
        this.rowKey = rowKey;
    }

    // tslint:disable-next-line:function-name
    public static fromObj(savableObj: IAzureDocumentSavable): AzureDocumentIdentifier {
        return new this(savableObj.partitionKey, savableObj.rowKey);
    }
}

// tslint:disable-next-line:max-classes-per-file no-unnecessary-class
export class AzureDocumentCacheData<T extends IAzureDocumentSavable> {
    public tableDict: Dictionary<AzureDocumentTableCacheData<T>> = {};
}

// tslint:disable-next-line:max-classes-per-file no-unnecessary-class
export class AzureDocumentTableCacheData<T extends IAzureDocumentSavable> {
    public entityDict: Dictionary<T> = {};
    public expireDict: Dictionary<moment.Moment> = {};
    public queryDict: Dictionary<AzureDocumentIdentifier[]> = {};
    public queryExpireDict: Dictionary<moment.Moment> = {};
}

export interface IAzureDocumentCache<T extends IAzureDocumentSavable> {
    getItem(table: string, id: AzureDocumentIdentifier): T;
    getItemsByQuery(table: string, query: TableQuery): T[];
    setItem(table: string, obj: T, expirationDur: moment.Duration): void;
    setItemsByQuery(table: string, objs: T[], query: TableQuery, expirationDur: moment.Duration): void;
    resetTableCache(table: string): void;
    invalidateCacheItem(table: string, id: AzureDocumentIdentifier): void;
}

// tslint:disable-next-line:max-classes-per-file no-unnecessary-class
export class AzureTableDocumentCacheInMemory<T extends IAzureDocumentSavable> implements IAzureDocumentCache<T>, ITableCache<T> {
    private cache: AzureDocumentCacheData<T> = new AzureDocumentCacheData<T>();
    private doCleanup: boolean;
    private nextCleanup: moment.Moment;
    private cleanupInterval: moment.Duration;

    public constructor(doCleanup: boolean = true, cleanupInterval: moment.Duration = moment.duration(5, 'hours')) {
        this.doCleanup = doCleanup;
        this.cleanupInterval = this.cleanupInterval;
        this.nextCleanup = moment().add(this.cleanupInterval);
    }

    public getItem(table: string, id: DocumentIdentifier): T {
        let basicId: AzureDocumentIdentifier = new AzureDocumentIdentifier(id.partitionKey, id.rowKey);
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        let cachedObj: T = tableCache.entityDict[basicId.cacheKey];
        if (cachedObj === undefined) {
            return null;
        }

        if (cachedObj !== undefined && cachedObj !== null && this.isItemExpired(tableCache, basicId)) {
            this.resetCacheItem(tableCache, basicId);
            cachedObj = null;
        }

        return cachedObj;
    }

    public getItemsByQuery(table: string, query: TableQuery): T[] {
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        let returnArray: T[] = [];
        let queryString: string = query.toQueryObject.toString();
        
        let identifiers: AzureDocumentIdentifier[] = tableCache.queryDict[queryString];

        if (identifiers === undefined || identifiers === null) {
            return null;
        } else {
            // handle query expiration
            if (this.isQueryExpired(tableCache, queryString)) {
                this.resetCacheQuery(tableCache, queryString);
                for (let identifier of identifiers) {
                    this.resetItemIfExpired(tableCache, identifier);
                }

                return null;
            }
        }

        for (let identifier of identifiers) {
            let cachedObj: T = this.getItem(table, identifier);
            if (cachedObj === undefined || cachedObj === null) {
                // not returning null for the whole thing would break integrity.. 
                // don't want to successfully only query 3 out of the 5 for example
                return null; 
            }
            returnArray.push(cachedObj);
        }

        return returnArray;
    }

    // tslint:disable:no-console
    public setItem(table: string, obj: T, expirationDur: moment.Duration): void {
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        let identifier: AzureDocumentIdentifier = AzureDocumentIdentifier.fromObj(obj);
        this.setItemById(tableCache, obj, identifier, expirationDur);
        this.cleanupIfTime();
    }

    public setItemsByQuery(table: string, objs: T[], query: TableQuery, expirationDur: moment.Duration): void {
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        let queryIdentifiers: AzureDocumentIdentifier[] = [];

        for (let curObj of objs) {
            let curIdentifier: AzureDocumentIdentifier = AzureDocumentIdentifier.fromObj(curObj);
            this.setItemById(tableCache, curObj, curIdentifier, expirationDur);
            queryIdentifiers.push(curIdentifier);
        }

        let queryString: string = query.toQueryObject.toString();
        tableCache.queryDict[queryString] = queryIdentifiers;
        tableCache.queryExpireDict[queryString] = moment().add(expirationDur);
        this.cleanupIfTime();
    }

    public resetTableCache(table: string): void {
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        tableCache.entityDict = {};
        tableCache.expireDict = {};
        tableCache.queryDict = {};
        tableCache.queryExpireDict = {};
    }

    public invalidateCacheItem(table: string, id: AzureDocumentIdentifier): void {
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        this.resetCacheItem(tableCache, id);
    }

    private setItemById(tableCache: AzureDocumentTableCacheData<T>, obj: T, identifier: AzureDocumentIdentifier, expirationDur: moment.Duration): void {
        tableCache.entityDict[identifier.cacheKey] = obj;
        tableCache.expireDict[identifier.cacheKey] = moment().add(expirationDur);
    }

    private isItemExpired(tableCache: AzureDocumentTableCacheData<T>, id: AzureDocumentIdentifier): boolean {
        let currentTime: moment.Moment = moment();
        let expiration: moment.Moment = tableCache.expireDict[id.cacheKey];
        if (expiration !== undefined && expiration !== null && currentTime.isAfter(expiration)) {
            return true;
        }

        return false;
    }

    private isQueryExpired(tableCache: AzureDocumentTableCacheData<T>, queryString: string): boolean {
        let currentTime: moment.Moment = moment();
        let expiration: moment.Moment = tableCache.queryExpireDict[queryString];
        if (expiration !== undefined && expiration !== null && currentTime.isAfter(expiration)) {
            return true;
        }

        return false;
    }

    private resetItemIfExpired(tableCache: AzureDocumentTableCacheData<T>, id: AzureDocumentIdentifier): void {
        if (this.isItemExpired(tableCache, id)) {
            this.resetCacheItem(tableCache, id);
        }
    }

    private resetCacheItem(tableCache: AzureDocumentTableCacheData<T>, id: AzureDocumentIdentifier): void {
        tableCache.entityDict[id.cacheKey] = undefined;
        tableCache.expireDict[id.cacheKey] = undefined;
        delete tableCache.entityDict[id.cacheKey];
        delete tableCache.expireDict[id.cacheKey];
    }

    private resetCacheQuery(tableCache: AzureDocumentTableCacheData<T>, queryString: string): void {
        tableCache.queryDict[queryString] = undefined;
        tableCache.queryExpireDict[queryString] = undefined;
        delete tableCache.queryDict[queryString];
        delete tableCache.queryExpireDict[queryString];
    }

    // Cleanup is called whenever we set a new object in cache. 
    // We only cleanup once per cleanup interval.
    private cleanupIfTime(): Promise<boolean> {
        return new Promise<boolean>((resolve: (val: boolean) => void) => {
            if (this.doCleanup) {
                if (moment().isAfter(this.nextCleanup)) {
                    this.setNextCleanup();
                    this.cleanup();
                }
            }
            resolve(true);
        });
    }

    // Will clean up any remaining expired cached entities.
    private cleanup(): void {
        let now: moment.Moment = moment();
        Object.keys(this.cache.tableDict).forEach((tableKey: string) => {
            let tableCache: AzureDocumentTableCacheData<T> = this.cache.tableDict[tableKey];

            // clean up expired entities
            Object.keys(tableCache.entityDict).forEach((entityKey: string) => {
                let entity: T = tableCache.entityDict[entityKey];
                let expireTime: moment.Moment = tableCache.expireDict[entityKey];
                if (now.isAfter(expireTime)) {
                    let identifier: AzureDocumentIdentifier =  AzureDocumentIdentifier.fromObj(entity);
                    this.resetCacheItem(tableCache, identifier);
                }
            });

            // clean up expired queries
            Object.keys(tableCache.queryDict).forEach((queryKey: string) => {
                let entities: AzureDocumentIdentifier[] = tableCache.queryDict[queryKey];
                let queryExpireTime: moment.Moment = tableCache.queryExpireDict[queryKey];
                if (now.isAfter(queryExpireTime)) {
                    this.resetCacheQuery(tableCache, queryKey);
                }
            });
        });
    }

    private setNextCleanup(): void {
        this.nextCleanup = moment().add(this.cleanupInterval);
    }

    private getTableCache(table: string): AzureDocumentTableCacheData<T> {
        let tableCache: AzureDocumentTableCacheData<T> = this.cache.tableDict[table];
        if (tableCache === undefined || tableCache === null) {
            tableCache = new AzureDocumentTableCacheData<T>();
            this.cache.tableDict[table] = tableCache;
        }

        return tableCache;
    }
}
