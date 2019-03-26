import { IBasicCache, IBasicTimedCache, IClearableCache, Dictionary, IBasicAsyncCache, IBasicAsyncTimedCache, IAsyncClearableCache } from 'tsdatautils-core';
import * as moment from 'moment';

class CacheData {
    public entityDict: Dictionary<any> = {};
    public expireDict: Dictionary<moment.Moment> = {};
}

export class BasicMemoryCache implements IBasicCache, IBasicTimedCache, IClearableCache, IBasicAsyncCache, IBasicAsyncTimedCache, IAsyncClearableCache {
    private cache: CacheData = new CacheData();
    private doCleanup: boolean;
    private nextCleanup: moment.Moment;
    private cleanupInterval: moment.Duration;

    public constructor(doCleanup: boolean = true, cleanupInterval: moment.Duration = moment.duration(5, 'hours')) {
        this.doCleanup = doCleanup;
        this.cleanupInterval = cleanupInterval;
        this.nextCleanup = moment().add(cleanupInterval);
    }
    
    public getItem<T>(key: string): T {
        let cachedObj: T = this.cache.entityDict[key];
        if (cachedObj === undefined) {
            return null;
        }

        if (cachedObj !== undefined && cachedObj !== null && this.isItemExpired(this.cache, key)) {
            this.resetCacheItem(this.cache, key);
            cachedObj = null;
        }

        return cachedObj;
    }
    
    public getItemAsync<T>(key: string): Promise<T> {
        return new Promise<T>((resolve: (val: T) => void, reject: (reason: any) => void) => {
            try {
                let item: T = this.getItem<T>(key);

                resolve(item);
            } catch (ex) {
                reject(ex);
            }
        });
    }
    
    public setItem<T>(key: string, item: T, ttl: moment.Duration = null): boolean {
        this.setItemById(this.cache, item, key, ttl);
        this.cleanupIfTime();

        return true;
    }

    public setItemAsync<T>(key: string, item: T, ttl: moment.Duration = null): Promise<boolean> {
        return new Promise<boolean>((resolve: (val: boolean) => void, reject: (reason: any) => void) => {
            try {
                let worked: boolean = this.setItem<T>(key, item, ttl);

                resolve(worked);
            } catch (ex) {
                reject(ex);
            }
        });
    }

    public removeItem(key: string): boolean {
        this.resetCacheItem(this.cache, key);

        return true;
    }

    public removeItemAsync(key: string): Promise<boolean> {
        return new Promise<boolean>((resolve: (val: boolean) => void, reject: (reason: any) => void) => {
            try {
                let worked: boolean = this.removeItem(key);

                resolve(worked);
            } catch (ex) {
                reject(ex);
            }
        });
    }

    public clearCache(): void {
        this.cache.entityDict = {};
        this.cache.expireDict = {};
    }
    
    public clearCacheAsync(): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (reason: any) => void) => {
            try {
                this.clearCache();

                resolve();
            } catch (ex) {
                reject(ex);
            }
        });
    }

    // Private functions
    private setItemById(tableCache: CacheData, obj: any, key: string, expirationDur: moment.Duration): void {
        tableCache.entityDict[key] = obj;
        tableCache.expireDict[key] = moment().add(expirationDur);
    }

    private isItemExpired(tableCache: CacheData, key: string): boolean {
        let currentTime: moment.Moment = moment();
        let expiration: moment.Moment = tableCache.expireDict[key];
        if (expiration !== undefined && expiration !== null && currentTime.isAfter(expiration)) {
            return true;
        }

        return false;
    }

    private resetCacheItem(tableCache: CacheData, key: string): void {
        tableCache.entityDict[key] = undefined;
        tableCache.expireDict[key] = undefined;
        delete tableCache.entityDict[key];
        delete tableCache.expireDict[key];
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
        // clean up expired entities
        Object.keys(this.cache.entityDict).forEach((entityKey: string) => {
            let entity: any = this.cache.entityDict[entityKey];
            let expireTime: moment.Moment = this.cache.expireDict[entityKey];
            if (now.isAfter(expireTime)) {
                this.resetCacheItem(this.cache, entityKey);
            }
        });
    }

    private setNextCleanup(): void {
        this.nextCleanup = moment().add(this.cleanupInterval);
    }

}
