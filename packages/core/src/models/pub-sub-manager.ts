import { IOperationResult } from "./operation-result";
import { PubSubReceiveMessageResult } from "./pub-sub-message";

export interface IPubSubManager {
    initializeConnection(): Promise<void>;
    publish<T>(message: T): Promise<IOperationResult>;
    subscribe<T>(subscriberId: string, messageCallback: (message: T) => PubSubReceiveMessageResult, errorCallback: (err: Error) => void): Promise<IOperationResult>;
    unsubscribe(subscriberId: string): Promise<IOperationResult>;
    closeConnection(): Promise<void>;
}