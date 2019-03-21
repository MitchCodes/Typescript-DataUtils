import { DocumentIdentifier } from './document-identifier';
import * as moment from 'moment';

export interface ITableCache<T> {
    getItem(table: string, id: DocumentIdentifier): T;
    setItem(table: string, obj: T, expirationDur: moment.Duration): void;
    resetTableCache(table: string): void;
    invalidateCacheItem(table: string, id: DocumentIdentifier): void;
}
