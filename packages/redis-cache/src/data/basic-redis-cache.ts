import { Dictionary, IBasicAsyncCache, IBasicAsyncTimedCache, IAsyncClearableCache, ILogger, JsonSerializer, DateJsonPropertyHandler, UndefinedJsonPropertyHandler } from 'tsdatautils-core';
import * as moment from 'moment';
import { createClient } from 'redis';

type RedisClientType = ReturnType<typeof createClient>;
type RedisClientOptions = Parameters<typeof createClient>[0];

export class BasicRedisCache implements IBasicAsyncCache, IBasicAsyncTimedCache, IAsyncClearableCache {
    private static clients: Dictionary<RedisClientType>;

    public logger: ILogger = null;
    public waitTimeCommandSeconds: number = 5;

    private clientKey: string = null;
    private port: number = 6379;
    private hostIp: string = '127.0.0.1';
    private authPass: string = null;
    private options: RedisClientOptions = {};

    public constructor(logger: ILogger = null, clientKey: string, hostIp: string = '127.0.0.1', port: number = 6379, authPass: string = null, options: RedisClientOptions = {}) {
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
            // Start client creation asynchronously - methods will wait for connection
            BasicRedisCache.createClient(clientKey, port, hostIp, authPass, options, logger).catch(() => {
                // Log error but don't throw in constructor - methods will handle connection errors
                if (logger) {
                    logger.error('Failed to create Redis client during initialization');
                }
            });
        }
    }

    public static async forceCloseAllClients(): Promise<void> {
        for (const key of Object.keys(BasicRedisCache.clients)) {
            const currentClient: RedisClientType = BasicRedisCache.clients[key];
            if (currentClient && currentClient.isOpen) {
                await currentClient.quit();
            }
        }
        BasicRedisCache.clients = {};
    }

    private static async createClient(clientKey: string, port: number = 6379, hostIp: string = '127.0.0.1', authPass: string = null, options: RedisClientOptions = {}, logger: ILogger = null): Promise<void> {
        BasicRedisCache.clients[clientKey] = null;
        try {
            // Build Redis URL from components
            let url = `redis://${hostIp}:${port}`;
            if (authPass) {
                // URL format: redis://[username:]password@host:port
                url = `redis://:${authPass}@${hostIp}:${port}`;
            }

            const clientOptions: RedisClientOptions = {
                url: url,
                ...options
            };

            const redisClient: RedisClientType = createClient(clientOptions);

            BasicRedisCache.registerClientEventHandlers(clientKey, redisClient, logger);
            await redisClient.connect();
            BasicRedisCache.clients[clientKey] = redisClient;
        } catch (ex) {
            BasicRedisCache.clients[clientKey] = undefined;
            throw ex;
        }
    }

    private static registerClientEventHandlers(clientKey: string, redisClient: RedisClientType, logger: ILogger): void {
        redisClient.on('connect', () => { 
            if (logger !== undefined && logger !== null) {
                logger.info('Redis ' + clientKey + ' connected.');
            }
        });

        redisClient.on('ready', () => { 
            if (logger !== undefined && logger !== null) {
                logger.info('Redis ' + clientKey + ' ready.');
            }
        });

        redisClient.on('reconnecting', () => { 
            if (logger !== undefined && logger !== null) {
                logger.info('Redis ' + clientKey + ' reconnecting.');
            }
        });

        redisClient.on('end', () => { 
            if (logger !== undefined && logger !== null) {
                logger.info('Redis ' + clientKey + ' ended.');
            }
        });

        redisClient.on('error', (err: any) => {
            if (logger !== undefined && logger !== null) {
                logger.error(err);
            }
        });
    }

    public async getItemAsync<T>(key: string): Promise<T> {
        try {
            let client: RedisClientType = BasicRedisCache.clients[this.clientKey];
            await this.ensureConnection(client);
            
            // Get the client again after ensuring connection
            client = BasicRedisCache.clients[this.clientKey];
            this.throwIfClientDoesNotExist(client);
            
            const res: string | null = await client.get(key);
            
            if (res === undefined) {
                return undefined;
            } else if (res === null) {
                return null;
            } else {
                const jsonSerializer: JsonSerializer = new JsonSerializer([new DateJsonPropertyHandler(), new UndefinedJsonPropertyHandler()]);
                const resParsed: T = jsonSerializer.parse(res);
                return resParsed;
            }
        } catch (err) {
            throw err;
        }
    }

    public async setItemAsync<T>(key: string, item: T, ttl: moment.Duration = null): Promise<boolean> {
        try {
            let client: RedisClientType = BasicRedisCache.clients[this.clientKey];
            await this.ensureConnection(client);
            
            // Get the client again after ensuring connection
            client = BasicRedisCache.clients[this.clientKey];
            this.throwIfClientDoesNotExist(client);
            
            let itemStringified: string = null;

            if (item !== undefined && item !== null) {
                const jsonSerializer: JsonSerializer = new JsonSerializer([new DateJsonPropertyHandler(), new UndefinedJsonPropertyHandler()]);
                itemStringified = jsonSerializer.stringify(item);
            }

            if (ttl === null) {
                await client.set(key, itemStringified);
            } else {
                await client.setEx(key, ttl.asSeconds(), itemStringified);
            }

            return true;
        } catch (err) {
            throw err;
        }
    }

    public async removeItemAsync(key: string): Promise<boolean> {
        try {
            let client: RedisClientType = BasicRedisCache.clients[this.clientKey];
            await this.ensureConnection(client);
            
            // Get the client again after ensuring connection
            client = BasicRedisCache.clients[this.clientKey];
            this.throwIfClientDoesNotExist(client);
            
            await client.del(key);
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async clearCacheAsync(): Promise<void> {
        try {
            let client: RedisClientType = BasicRedisCache.clients[this.clientKey];
            await this.ensureConnection(client);
            
            // Get the client again after ensuring connection
            client = BasicRedisCache.clients[this.clientKey];
            this.throwIfClientDoesNotExist(client);
            
            await client.flushAll();
        } catch (err) {
            throw err;
        }
    }

    private throwIfClientDoesNotExist(client: RedisClientType) {
        if (client === undefined || client === null) {
            throw new Error('Redis client missing.');
        }
    }

    private async ensureConnection(client: RedisClientType): Promise<void> {
        // If client is null or undefined, try to recreate it
        if (!client) {
            await BasicRedisCache.createClient(this.clientKey, this.port, this.hostIp, this.authPass, this.options, this.logger);
            const newClient = BasicRedisCache.clients[this.clientKey];
            if (!newClient) {
                throw new Error('Failed to create Redis client');
            }
            client = newClient;
        }

        if (!client.isReady) {
            if (!client.isOpen) {
                await client.connect();
            }
            
            const stopWaitingTime: moment.Moment = moment().add(this.waitTimeCommandSeconds, 'seconds');
            await this.waitForConnection(client, stopWaitingTime);
        }
    }

    private async waitForConnection(client: RedisClientType, stopWaitingTime: moment.Moment): Promise<void> {
        while (!client.isReady && moment().isBefore(stopWaitingTime)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!client.isReady) {
            throw new Error('Redis client not ready - connection timeout');
        }
    }

}
