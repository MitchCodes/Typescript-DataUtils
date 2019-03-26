import { IBasicCache, IBasicTimedCache, IClearableCache, Dictionary, IBasicAsyncCache, IBasicAsyncTimedCache, IAsyncClearableCache } from 'tsdatautils-core';
import * as moment from 'moment';
import { RedisClient, ClientOpts, createClient, RetryStrategyOptions, RetryStrategy } from 'redis';
import { ClientResponse } from 'http';
import { promisify } from 'util';

export class BasicRedisCache implements IBasicAsyncCache, IBasicAsyncTimedCache, IAsyncClearableCache {
    private static clients: Dictionary<RedisClient>;
    private clientKey: string = null;

    public constructor(clientKey: string, port: number = 6379, hostIp: string = '127.0.0.1', authPass: string = null, options: ClientOpts = {}) {
        if (clientKey === undefined || clientKey === null) {
            throw new Error('Cannot have a null or undefined client key');
        }
        this.clientKey = clientKey;
        
        if (BasicRedisCache.clients === undefined) {
            BasicRedisCache.clients = {};
        }
        
        if (BasicRedisCache.clients[clientKey] === undefined) {
            BasicRedisCache.createClient(clientKey, port, hostIp, authPass, options);
        }
    }

    private static createClient(clientKey: string, port: number = 6379, hostIp: string = '127.0.0.1', authPass: string = null, options: ClientOpts = {}): void {
        BasicRedisCache.clients[clientKey] = null;
        try {
            options.password = authPass;
            options.port = port;
            options.host = hostIp;

            options.retry_strategy = (retryOptions: RetryStrategyOptions): number | Error => {
                if (retryOptions.error && retryOptions.error.code === 'ECONNREFUSED') {
                    // End reconnecting on a specific error and flush all commands with
                    // a individual error
                    return new Error('The server refused the connection');
                }
                if (retryOptions.total_retry_time > 1000 * 60 * 60) {
                    // End reconnecting after a specific timeout and flush all commands
                    // with a individual error
                    return new Error('Retry time exhausted');
                }
                if (retryOptions.attempt > 10) {
                    // End reconnecting with built in error
                    return undefined;
                }

                // reconnect after
                return Math.min(retryOptions.attempt * 100, 3000);
            };

            let redisClient: RedisClient = createClient(options);

            //BasicRedisCache.registerClientEventHandlers(redisClient);
            BasicRedisCache.clients[clientKey] = redisClient;
        } catch (ex) {
            throw ex;
        } finally {
            BasicRedisCache.clients[clientKey] = undefined;
        }
    }

    //private static registerClientEventHandlers(redisClient: RedisClient): void {

    //}

    public getItemAsync<T>(key: string): Promise<T> {
        return new Promise<T>((resolve: (val: T) => void, reject: (reason: any) => void) => {
            try {
                let client: RedisClient = BasicRedisCache.clients[this.clientKey];
                this.throwIfClientDoesNotExist(client);
                this.throwIfNotConnected(client);

                let getAsync: any = promisify(client.get).bind(client);
                getAsync(key).then((res: string) => {
                    try {
                        let resParsed: T = JSON.parse(res);
                        resolve(resParsed);
                    } catch (err) {
                        reject(err);
                    }
                }).catch((err: any) => {
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    public setItemAsync<T>(key: string, item: T, ttl: moment.Duration = null): Promise<boolean> {
        return new Promise<boolean>((resolve: (val: boolean) => void, reject: (reason: any) => void) => {
            try {
                let client: RedisClient = BasicRedisCache.clients[this.clientKey];
                this.throwIfClientDoesNotExist(client);
                this.throwIfNotConnected(client);

                let itemStringified: string = JSON.stringify(item);

                let setAsync: any = promisify(client.set).bind(client);
                let setPromise: any = null;

                if (ttl === null) {
                    setPromise = setAsync(key, itemStringified);
                } else {
                    setPromise = setAsync(key, itemStringified, 'EX', ttl.asSeconds());
                }

                setPromise.then((res: string) => {
                    resolve(true);
                }).catch((err: any) => {
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    public removeItemAsync(key: string): Promise<boolean> {
        return new Promise<boolean>((resolve: (val: boolean) => void, reject: (reason: any) => void) => {
            try {
                let client: RedisClient = BasicRedisCache.clients[this.clientKey];
                this.throwIfClientDoesNotExist(client);
                this.throwIfNotConnected(client);

                let delAsync: any = promisify(client.del).bind(client);

                delAsync(key).then((res: number) => {
                    resolve(true);
                }).catch((err: any) => {
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    public clearCacheAsync(): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (reason: any) => void) => {
            try {
                let client: RedisClient = BasicRedisCache.clients[this.clientKey];
                this.throwIfClientDoesNotExist(client);
                this.throwIfNotConnected(client);

                let flushAllAsync: any = promisify(client.flushall).bind(client);

                flushAllAsync().then(() => {
                    resolve();
                }).catch((err: any) => {
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    private throwIfClientDoesNotExist(client: RedisClient) {
        if (client === undefined || client === null) {
            throw new Error('Redis client missing.');
        }
    }

    private throwIfNotConnected(client: RedisClient) {
        if (!client.connected) {
            throw new Error('Redis not connected');
        }
    }

}
