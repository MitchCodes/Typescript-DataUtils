import { IOperationResult } from "./operation-result";
import { QueueMessageResult } from "./queue-message";
import { QueueMessageOptions } from "./queue-message-options";

export interface IQueueStorageManager {
    initializeConnection(): Promise<void>;
    createQueueIfNotExists(queueName: string): Promise<IOperationResult>;
    addMessage<T>(queueName: string, message: T, options: QueueMessageOptions): Promise<IOperationResult>;
    getNextMessage<T>(queueName: string): Promise<QueueMessageResult<T>>;
    peekNextMessage<T>(queueName: string): Promise<QueueMessageResult<T>>;
    deleteMessage(queueName: string, messageId: string): Promise<IOperationResult>;
}