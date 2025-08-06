import * as Transport from 'winston-transport';
import { Configuration, setup, start, defaultClient, TelemetryClient, Contracts } from 'applicationinsights';

// inspired by https://github.com/willmorgan/winston-azure-application-insights/blob/develop/lib/winston-azure-application-insights.js

export class AzureApplicationInsightsWinstonTransport extends Transport {
    public sendErrorsAsExceptions: boolean = true;

    private loggerName: string = 'azure_appinsights_logger';
    private telemetryClient: TelemetryClient = null;

    public constructor(sendErrorsAsExceptions: boolean = true, client: TelemetryClient | string = null, transportOptions: Transport.TransportStreamOptions = {}) {
        super(transportOptions);
        this.sendErrorsAsExceptions = sendErrorsAsExceptions;

        if (client !== null) {
            if (client instanceof TelemetryClient) {
                this.telemetryClient = client;
            } else {
                this.setupClient(<string>client);
            }
        }
    }

    public setupClient(instrumentationKey: string) {
        setup(instrumentationKey).start();
        this.telemetryClient = defaultClient;
    }

    public log(info: any, callback: Function) {
        let message: any = info.message;
        let level: string = info.level;
        const severity = this.getMessageLevel(level);
        const splat = info[Symbol.for('splat')] || [];
        const logMeta = splat.length ? splat[0] : {};

        this.handleTrace(severity, info, message, logMeta);

        if (this.sendErrorsAsExceptions && severity >= this.getMessageLevel('error')) {
            this.handleException(info, message, logMeta);
        }

        return callback(null, true);
    }

    private handleException(info: any, message: any, logMeta: any) {
        let exceptionProps: any = {};
        let exception: Error = null;
        if (this.isError(info)) {
            exception = info;
        } else if (this.isError(message)) {
            exception = message;
        } else if (this.isError(logMeta)) {
            exception = logMeta;
        } else {
            return;
        }

        // If a custom message is sent accompanying the exception, set it inside properties:
        if (typeof message === 'string' && exception.message !== message) {
            exceptionProps.message = message;
        }
        // If log context is sent with the error then set those inside properties:
        if (exception !== logMeta) {
            Object.assign(exceptionProps, logMeta);
        }
        this.telemetryClient.trackException({
            exception,
            properties: exceptionProps,
        });
    }

    private getMessageLevel(winstonLevel: string) {
        // Map to numeric severity levels for new Application Insights SDK
        const levels = {
            emerg: 4, // Critical
            alert: 4, // Critical
            crit: 4, // Critical
            error: 3, // Error
            warning: 2, // Warning
            warn: 2, // Warning
            notice: 1, // Information
            info: 1, // Information
            verbose: 0, // Verbose
            debug: 0, // Verbose
            silly: 0, // Verbose
        };
    
        return winstonLevel in levels ? levels[winstonLevel] : levels.info;
    }

    private handleTrace(severity: any, info: any, message: any, logMeta: any) {
        let traceProps: any = this.extractPropsFromInfo(info);

        let errorArg: Error = null;

        if (this.isError(info)) {
            errorArg = info;
        } else if (this.isError(message)) {
            errorArg = message;
        } else if (this.isError(logMeta)) {
            errorArg = logMeta;
        }

        if (errorArg !== null) {
            // If info, message or logMeta is an error, trim it and set the properties:
            Object.assign(traceProps, this.extractErrorPropsForTrace(errorArg));
        }

        if (logMeta !== errorArg) {
            // If we have some log context, set the properties:
            Object.assign(traceProps, logMeta);
        }

        this.telemetryClient.trackTrace({
            message: message.toString(),
            severity: severity,
            properties: traceProps,
        });
    }

    private extractPropsFromInfo(info: any): any {
        let infoKeys: string[] = Object.keys(info);
        let returnObj: any = {};
        for (let key of infoKeys) {
            if (key !== 'level' && key !== 'message') {
                returnObj[key] = info[key];
            }
        }

        return returnObj;
    }

    private extractErrorPropsForTrace(errorLike: Error): any {
        let properties: any = {
            message: errorLike.message,
        };

        for (let key of Object.keys(errorLike)) { // eslint-disable-line no-restricted-syntax
            if (key !== 'stack' && Object.prototype.hasOwnProperty.call(errorLike, key)) {
                properties[key] = errorLike[key];
            }
        }

        return properties;
    }

    private isError(obj: any): boolean {
        return obj instanceof Error;
    }
}
