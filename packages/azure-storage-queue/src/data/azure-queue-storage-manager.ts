import { ErrorHelper, IOperationResult, IOperationResultWithData, IQueueMessage, IQueueStorageManager, QueueMessageOptions, QueueMessageResult } from "tsdatautils-core";
import { DequeuedMessageItem, MessageIdDeleteResponse, PeekedMessageItem, QueueClient, QueueCreateIfNotExistsResponse, QueuePeekMessagesResponse, QueueReceiveMessageResponse, QueueSendMessageResponse, QueueServiceClient, StorageSharedKeyCredential } from "@azure/storage-queue";
import { AzureQueueDocumentResult, AzureQueueDocumentResultWithData } from "../models/queue-document-result";
import { QueueMessageConverter } from "../converter/queue-message-converter";

export class AzureQueueStorageManager implements IQueueStorageManager {
    private storageAccount: string = '';
    private storageKey: string = '';
    private storageCredential: StorageSharedKeyCredential = null;
    private queueServiceClient: QueueServiceClient = null;

    public constructor(azureStorageAccount: string = '', azureStorageKey: string = '',) {
        this.storageAccount = azureStorageAccount;
        this.storageKey = azureStorageKey;
    }

    public async initializeConnection(): Promise<void> {
        this.storageCredential = new StorageSharedKeyCredential(this.storageAccount, this.storageKey);
        this.queueServiceClient = new QueueServiceClient(`https://${this.storageAccount}.queue.core.windows.net`, this.storageCredential);
    }

    public async createQueueIfNotExists(queueName: string): Promise<IOperationResult> {
        let result: IOperationResult = AzureQueueDocumentResult.buildSuccess();

        try {
            let queueClient: QueueClient = await this.queueServiceClient.getQueueClient(queueName);
            let response: QueueCreateIfNotExistsResponse = await queueClient.createIfNotExists();
        } catch (err) {
            result = AzureQueueDocumentResult.buildSimpleError('Error creating queue: ' + err, ErrorHelper.isError(err) ? err : new Error(err));
        }

        return result;
    }

    public async addMessage<T>(queueName: string, message: T, options: QueueMessageOptions = null): Promise<IOperationResult> {
        let result: IOperationResult = AzureQueueDocumentResult.buildSuccess();

        if (!options) {
            options = new QueueMessageOptions();
        }

        try {
            let queueClient: QueueClient = await this.queueServiceClient.getQueueClient(queueName);

            let messageConverter: QueueMessageConverter = new QueueMessageConverter();
            let queueMessage: IQueueMessage<T> = await messageConverter.convertToMessage<T>(message, options);

            let queueMessageStringified: string = JSON.stringify(queueMessage);
            let response: QueueSendMessageResponse = await queueClient.sendMessage(queueMessageStringified);
        } catch (err) {
            result = AzureQueueDocumentResult.buildSimpleError('Error adding message: ' + err, ErrorHelper.isError(err) ? err : new Error(err));
        }

        return result;
    }

    public async getNextMessage<T>(queueName: string): Promise<QueueMessageResult<T>> {
        let result: QueueMessageResult<T> = AzureQueueDocumentResultWithData.buildSuccess<T>(null);
        result.data = null;

        try {
            let queueClient: QueueClient = await this.queueServiceClient.getQueueClient(queueName);

            let response: QueueReceiveMessageResponse = await queueClient.receiveMessages();
            if (response && response.receivedMessageItems && response.receivedMessageItems.length > 0) {
                let firstItem: DequeuedMessageItem = response.receivedMessageItems[0];
                let itemString: string = firstItem.messageText;

                if (itemString) {
                    let queueMessage: IQueueMessage<T> = <IQueueMessage<T>>JSON.parse(itemString);
                    if (queueMessage) {
                        let messageConverter: QueueMessageConverter = new QueueMessageConverter();
                        let messageConverted: T = await messageConverter.convertFromMessage<T>(queueMessage);
                        result.data = messageConverted;
                        result.messageId = firstItem.messageId + "|" + firstItem.popReceipt;
                    }
                }
            }
        } catch (err) {
            result = AzureQueueDocumentResultWithData.buildSimpleError('Error getting message: ' + err, ErrorHelper.isError(err) ? err : new Error(err));
        }

        return result;
    }

    public async peekNextMessage<T>(queueName: string): Promise<QueueMessageResult<T>> {
        let result: QueueMessageResult<T> = AzureQueueDocumentResultWithData.buildSuccess<T>(null);
        result.data = null;

        try {
            let queueClient: QueueClient = await this.queueServiceClient.getQueueClient(queueName);

            let response: QueuePeekMessagesResponse = await queueClient.peekMessages();
            if (response && response.peekedMessageItems && response.peekedMessageItems.length > 0) {
                let firstItem: PeekedMessageItem = response.peekedMessageItems[0];
                let itemString: string = firstItem.messageText;

                if (itemString) {
                    let queueMessage: IQueueMessage<T> = <IQueueMessage<T>>JSON.parse(itemString);
                    if (queueMessage) {
                        let messageConverter: QueueMessageConverter = new QueueMessageConverter();
                        let messageConverted: T = await messageConverter.convertFromMessage<T>(queueMessage);
                        result.data = messageConverted;
                        result.messageId = firstItem.messageId + "|";
                    }
                }
            }
        } catch (err) {
            result = AzureQueueDocumentResultWithData.buildSimpleError('Error peeking message: ' + err, ErrorHelper.isError(err) ? err : new Error(err));
        }

        return result;
    }

    public async deleteMessage(queueName: string, messageId: string): Promise<IOperationResult> {
        let result: IOperationResult = AzureQueueDocumentResult.buildSuccess();

        try {
            let queueClient: QueueClient = await this.queueServiceClient.getQueueClient(queueName);
            
            let messageSplit: string[] = messageId.split('|');
            if (messageSplit.length !== 2) {
                throw new Error('Message id not in the right format. Requires format: messageId|popReceipt');
            }

            let messageIdDeleteResponse: MessageIdDeleteResponse = await queueClient.deleteMessage(messageSplit[0], messageSplit[1]);
        } catch (err) {
            result = AzureQueueDocumentResult.buildSimpleError('Error deleting message: ' + err, ErrorHelper.isError(err) ? err : new Error(err));
        }

        return result;
    }
}
