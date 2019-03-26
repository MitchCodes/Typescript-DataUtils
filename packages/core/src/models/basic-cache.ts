import * as moment from 'moment';

export interface IBasicCache {
    getItem<T>(key: string): T;
    setItem<T>(key: string, item: T): boolean;
    removeItem(key: string): boolean;
}

export interface IBasicTimedCache {
    getItem<T>(key: string): T;
    setItem<T>(key: string, item: T, ttl: moment.Duration): boolean;
    removeItem(key: string): boolean;
}

export interface IBasicAsyncCache {
    getItemAsync<T>(key: string): Promise<T>;
    setItemAsync<T>(key: string, item: T): Promise<boolean>;
    removeItemAsync(key: string): Promise<boolean>;
}

export interface IBasicAsyncTimedCache {
    getItemAsync<T>(key: string): Promise<T>;
    setItemAsync<T>(key: string, item: T, ttl: moment.Duration): Promise<boolean>;
    removeItemAsync(key: string): Promise<boolean>;
}

export interface IClearableCache {
    clearCache(): void;
}

export interface IAsyncClearableCache {
    clearCacheAsync(): Promise<void>;
}
