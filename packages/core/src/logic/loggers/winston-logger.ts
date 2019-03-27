import { ILogger } from '../../models/logger';
import * as winston from 'winston';

export class WinstonLogger implements ILogger {
    private internalLogger: winston.LoggerInstance;

    public constructor(internalLogger: winston.LoggerInstance = null) {
        if (internalLogger === null) {
            internalLogger = new winston.Logger({
                level: 'debug',
                transports: [
                  new (winston.transports.Console)(),
                ],
              });
        }

        this.internalLogger = internalLogger;
    }

    public logDebug(msg: string): void {
        this.internalLogger.debug(msg);
    }

    public logInfo(msg: string): void {
        this.internalLogger.info(msg);
    }

    public logWarn(msg: string): void {
        this.internalLogger.warn(msg);
    }

    public logError(msg: string): void {
        this.internalLogger.error(msg);
    }

}
