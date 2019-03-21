import * as moment from 'moment';
import { Dictionary, DocumentIdentifier, ITableCache, BasicDocumentIdentifier} from 'tsdatautils-core';

// tslint:disable-next-line:max-classes-per-file no-unnecessary-class
export class AzureDocumentCacheData<T> {
    public tableDict: Dictionary<AzureDocumentTableCacheData<T>> = {};
}

// tslint:disable-next-line:max-classes-per-file no-unnecessary-class
export class AzureDocumentTableCacheData<T> {
    public entityDict: Dictionary<T> = {};
    public expireDict: Dictionary<moment.Moment> = {};
    public queryDict: Dictionary<DocumentIdentifier[]> = {};
    public queryExpireDict: Dictionary<moment.Moment> = {};
}

// tslint:disable-next-line:max-classes-per-file no-unnecessary-class
export class AzureTableDocumentCacheInMemory<T extends DocumentIdentifier> implements ITableCache<T> {
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
        let basicId: BasicDocumentIdentifier = new BasicDocumentIdentifier(id.partitionKey, id.rowKey);
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

    // tslint:disable:no-console
    public setItem(table: string, obj: T, expirationDur: moment.Duration): void {
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        let identifier: BasicDocumentIdentifier = new BasicDocumentIdentifier(obj.partitionKey, obj.rowKey);
        this.setItemById(tableCache, obj, identifier, expirationDur);
        this.cleanupIfTime();
    }

    public resetTableCache(table: string): void {
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        tableCache.entityDict = {};
        tableCache.expireDict = {};
        tableCache.queryDict = {};
        tableCache.queryExpireDict = {};
    }

    public invalidateCacheItem(table: string, id: BasicDocumentIdentifier): void {
        let tableCache: AzureDocumentTableCacheData<T> = this.getTableCache(table);
        this.resetCacheItem(tableCache, id);
    }

    private setItemById(tableCache: AzureDocumentTableCacheData<T>, obj: T, identifier: BasicDocumentIdentifier, expirationDur: moment.Duration): void {
        tableCache.entityDict[identifier.cacheKey] = obj;
        tableCache.expireDict[identifier.cacheKey] = moment().add(expirationDur);
    }

    private isItemExpired(tableCache: AzureDocumentTableCacheData<T>, id: BasicDocumentIdentifier): boolean {
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

    private resetItemIfExpired(tableCache: AzureDocumentTableCacheData<T>, id: BasicDocumentIdentifier): void {
        if (this.isItemExpired(tableCache, id)) {
            this.resetCacheItem(tableCache, id);
        }
    }

    private resetCacheItem(tableCache: AzureDocumentTableCacheData<T>, id: BasicDocumentIdentifier): void {
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
                    let identifier: BasicDocumentIdentifier = new BasicDocumentIdentifier(entity.partitionKey, entity.rowKey);
                    this.resetCacheItem(tableCache, identifier);
                }
            });

            // clean up expired queries
            Object.keys(tableCache.queryDict).forEach((queryKey: string) => {
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
