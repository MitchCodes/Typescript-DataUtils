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

export interface IClearableCache {
    clearCache(): void;
}
