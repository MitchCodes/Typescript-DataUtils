import { IBasicCache, IBasicTimedCache, IClearableCache, Dictionary, IBasicAsyncCache, IBasicAsyncTimedCache, IAsyncClearableCache, ILogger, JsonSerializer, DateJsonPropertyHandler, UndefinedJsonPropertyHandler } from 'tsdatautils-core';
import * as moment from 'moment';
import { RedisClient, ClientOpts, createClient, RetryStrategyOptions, RetryStrategy } from 'redis';
import { ClientResponse } from 'http';
import { promisify } from 'util';

export class BasicRedisCache implements IBasicAsyncCache, IBasicAsyncTimedCache, IAsyncClearableCache {
    private static clients: Dictionary<RedisClient>;

    public logger: ILogger = null;
    public waitTimeCommandSeconds: number = 5;

    private clientKey: string = null;
    private port: number = 6379;
    private hostIp: string = '127.0.0.1';
    private authPass: string = null;
    private options: ClientOpts = {};

    public constructor(logger: ILogger = null, clientKey: string, hostIp: string = '127.0.0.1', port: number = 6379, authPass: string = null, options: ClientOpts = {}) {
        if (clientKey === undefined || clientKey === null) {
            throw new Error('Cannot have a null or undefined client key');
        }
        
        this.clientKey = clientKey;
        this.port = port;
        this.hostIp = hostIp;
        this.authPass = authPass;
        this.options = options;

        this.logger = logger;
        
        if (BasicRedisCache.clients === undefined) {
            BasicRedisCache.clients = {};
        }
        
        if (BasicRedisCache.clients[clientKey] === undefined) {
            BasicRedisCache.createClient(clientKey, port, hostIp, authPass, options, logger);
        }
    }

    // tslint:disable-next-line: function-name
    public static forceCloseAllClients(): void {
        for (let key of Object.keys(BasicRedisCache.clients)) {
            let currentClient: RedisClient = BasicRedisCache.clients[key];
            currentClient.end(true);
        }
    }

    private static createClient(clientKey: string, port: number = 6379, hostIp: string = '127.0.0.1', authPass: string = null, options: ClientOpts = {}, logger: ILogger = null): void {
        BasicRedisCache.clients[clientKey] = null;
        try {
            
            if (authPass !== undefined && authPass !== null) {
                options.password = authPass;
            }
            
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

            BasicRedisCache.registerClientEventHandlers(clientKey, redisClient, logger);
            BasicRedisCache.clients[clientKey] = redisClient;
        } catch (ex) {
            BasicRedisCache.clients[clientKey] = undefined;
            throw ex;
        }
    }

    private static registerClientEventHandlers(clientKey: string, redisClient: RedisClient, logger: ILogger, options: ClientOpts = {}): void {
        redisClient.on('connect', () => { 
            if (logger !== undefined && logger !== null) {
                logger.logInfo('Redis ' + clientKey + ' connected.');
            }
        });

        redisClient.on('ready', () => { 
            if (logger !== undefined && logger !== null) {
                logger.logInfo('Redis ' + clientKey + ' ready.');
            }
        });

        redisClient.on('reconnecting', () => { 
            if (logger !== undefined && logger !== null) {
                logger.logInfo('Redis ' + clientKey + ' reconnecting.');
            }
        });

        redisClient.on('end', () => { 
            if (logger !== undefined && logger !== null) {
                logger.logInfo('Redis ' + clientKey + ' ended.');
            }
        });

        redisClient.on('error', (err: any) => {
            BasicRedisCache.handleError(err, logger, clientKey, options);
        });
    }

    private static handleError(err: any, logger: ILogger, clientKey: string, options: ClientOpts = {}): void {
        logger.logError(err);

        BasicRedisCache.createClient(clientKey, options.port, options.host, options.password, options, logger);
    }

    public getItemAsync<T>(key: string): Promise<T> {
        return new Promise<T>((resolve: (val: T) => void, reject: (reason: any) => void) => {
            try {
                let client: RedisClient = BasicRedisCache.clients[this.clientKey];
                this.throwIfClientDoesNotExist(client);
                this.confirmConnection(client).then(() => {
                    let getAsync: any = promisify(client.get).bind(client);
                    // tslint:disable-next-line: no-unsafe-any
                    getAsync(key).then((res: string) => {
                        try {
                            if (res === undefined) {
                                resolve(undefined);
                            } else if (res === null) {
                                resolve(null);
                            } else {
                                let jsonSerializer: JsonSerializer = new JsonSerializer([new DateJsonPropertyHandler(), new UndefinedJsonPropertyHandler()]);
                                let resParsed: T = jsonSerializer.parse(res);
                                resolve(resParsed);
                            }                            
                        } catch (err) {
                            reject(err);
                        }
                    }).catch((err: any) => {
                        reject(err);
                    });
                }).catch((err: string) => {
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
                this.confirmConnection(client).then(() => {
                    let itemStringified: string = null;

                    if (item !== undefined && item !== null) {
                        let jsonSerializer: JsonSerializer = new JsonSerializer([new DateJsonPropertyHandler(), new UndefinedJsonPropertyHandler()]);
                        itemStringified = jsonSerializer.stringify(item);
                    }

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
                }).catch((err: string) => {
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
                this.confirmConnection(client).then(() => {
                    let delAsync: any = promisify(client.del).bind(client);

                    delAsync(key).then((res: number) => {
                        resolve(true);
                    }).catch((err: any) => {
                        reject(err);
                    });
                }).catch((err: string) => {
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
                this.confirmConnection(client).then(() => {
                    let flushAllAsync: any = promisify(client.flushall).bind(client);

                    flushAllAsync().then(() => {
                        resolve();
                    }).catch((err: any) => {
                        reject(err);
                    });
                }).catch((err: string) => {
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

    private confirmConnection(client: RedisClient): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (reason: any) => void) => {
            if (client.connected) {
                resolve();
            } else {
                let stopWaitingTime: moment.Moment = moment().add(this.waitTimeCommandSeconds, 'seconds');
                this.waitForConnection(client, stopWaitingTime, resolve, reject);
            }
        });
    }

    private waitForConnection(client: RedisClient, stopWaitingTime: moment.Moment, resolve: () => void, reject: (reason: any) => void): void {
        if (client.connected) {
            resolve();
        } else {
            setTimeout(() => {
                if (moment().isAfter(stopWaitingTime)) {
                    reject('Not connected');
                } else {
                    this.waitForConnection(client, stopWaitingTime, resolve, reject);
                }
            // tslint:disable-next-line: align
            }, 500);
        }
    }

}
