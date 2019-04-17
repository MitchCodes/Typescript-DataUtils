import { ILogger } from '../../models/logger';
import { Logger, createLogger, transports } from 'winston';

export class WinstonLogger implements ILogger {
    private internalLogger: Logger;

    public constructor(internalLogger: Logger = null) {
        let tempLogger: Logger = internalLogger;
        if (tempLogger === null) {
            tempLogger = createLogger({
                level: 'debug',
                transports: [
                    new transports.Console(),
                ],
            });
        }

        this.internalLogger = tempLogger;
    }

    public debug(msg: string): void {
        this.internalLogger.debug(msg);
    }

    public info(msg: string): void {
        this.internalLogger.info(msg);
    }

    public warn(msg: string): void {
        this.internalLogger.warn(msg);
    }

    public error(msg: string): void {
        this.internalLogger.error(msg);
    }

}
