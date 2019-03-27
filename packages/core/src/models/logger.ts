export interface ILogger {
    logDebug(msg: string): void;
    logInfo(msg: string): void;
    logWarn(msg: string): void;
    logError(msg: string): void;
}
