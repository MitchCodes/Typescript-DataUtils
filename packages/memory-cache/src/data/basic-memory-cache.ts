import { IBasicCache, IBasicTimedCache, IClearableCache, Dictionary } from 'tsdatautils-core';
import * as moment from 'moment';

class CacheData {
    public entityDict: Dictionary<any> = {};
    public expireDict: Dictionary<moment.Moment> = {};
}

export class BasicMemoryCache implements IBasicCache, IBasicTimedCache, IClearableCache {
    private cache: CacheData = new CacheData();
    private doCleanup: boolean;
    private nextCleanup: moment.Moment;
    private cleanupInterval: moment.Duration;

    public constructor(doCleanup: boolean = true, cleanupInterval: moment.Duration = moment.duration(5, 'hours')) {
        this.doCleanup = doCleanup;
        this.cleanupInterval = cleanupInterval;
        this.nextCleanup = moment().add(cleanupInterval);
    }
    
    getItem<T>(key: string): T {
        throw new Error("Method not implemented.");
    }    
    
    setItem<T>(key: string, item: T, ttl: moment.Duration = null): boolean {
        throw new Error("Method not implemented.");
    }

    removeItem(key: string): boolean {
        throw new Error("Method not implemented.");
    }

    clearCache(): void {
        throw new Error("Method not implemented.");
    }

}
