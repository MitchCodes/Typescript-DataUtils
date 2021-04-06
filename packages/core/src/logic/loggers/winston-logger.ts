import { ILogger } from '../../models/logger';
import { Logger, createLogger, transports } from 'winston';
import moment from 'moment';

export class WinstonLogMessageModifier {
    public modifier: (inputMsg: string) => string;

    public constructor(modifier: (inputMsg: string) => string = null) {
        this.modifier = modifier;
    }
}

export enum WinstonDateStampType {
    HMS = 0,
    HMSMS = 1,
    UnixTimestampSeconds = 2,
    UnixTimestampMilliseconds = 2,
    DateHMS = 4,
    DateHMSMS = 5,
}

export class WinstonDateStampModifier extends WinstonLogMessageModifier {
    public constructor(type: WinstonDateStampType, delimiter: string = ': ') {
        super();

        this.modifier = (msg: string): string => {
            let time: moment.Moment = moment();
            let timeFormatted: string = time.toDate().getTime().toString();

            switch (type) {
                case WinstonDateStampType.DateHMS:
                    timeFormatted = time.format('M/D/YYYY h:mm:ss a');
                    break;
                case WinstonDateStampType.DateHMSMS:
                    timeFormatted = time.format('M/D/YYYY h:mm:ss:SSSS a');
                    break;
                case WinstonDateStampType.HMS:
                    timeFormatted = time.format('h:mm:ss a');
                    break;
                case WinstonDateStampType.HMSMS:
                    timeFormatted = time.format('h:mm:ss:SSSS a');
                    break;
                case WinstonDateStampType.UnixTimestampSeconds:
                    timeFormatted = time.format('X');
                    break;
                case WinstonDateStampType.UnixTimestampMilliseconds:
                    timeFormatted = time.format('x');
                    break;
            }

            return timeFormatted + delimiter + msg;
        };
    }
}

export class WinstonDateStampFormatModifier extends WinstonLogMessageModifier {
    public constructor(format: string, delimiter: string = ': ') {
        super();

        this.modifier = (msg: string): string => {
            let time: moment.Moment = moment();
            let timeFormatted: string = time.format(format);            

            return timeFormatted + delimiter + msg;
        };
    }
}

export class WinstonInterpolateModifier extends WinstonLogMessageModifier {
    public constructor(interpolate: string = '{{log}}') {
        super();

        this.modifier = (msg: string): string => {
            return interpolate.replace('{{log}}', msg);
        };
    }
}

export class WinstonLogger implements ILogger {
    private internalLogger: Logger;
    private messageModifiers: WinstonLogMessageModifier[] = [];

    public constructor(internalLogger: Logger = null, msgModifiers: WinstonLogMessageModifier[] = []) {
        this.messageModifiers = msgModifiers;

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

    private modifyMessage(msg: string): string {
        let finalMessage: string = msg;

        for (let messageModifier of this.messageModifiers) {
            if (messageModifier) {
                finalMessage = messageModifier.modifier(finalMessage);
            }
        }

        return finalMessage;
    }

    public debug(msg: string): void {
        this.internalLogger.debug(this.modifyMessage(msg));
    }

    public info(msg: string): void {
        this.internalLogger.info(this.modifyMessage(msg));
    }

    public warn(msg: string): void {
        this.internalLogger.warn(this.modifyMessage(msg));
    }

    public error(msg: string): void {
        this.internalLogger.error(this.modifyMessage(msg));
    }

}
