import { ProcessErrorArgs, ServiceBusClient, ServiceBusMessage, ServiceBusReceivedMessage, ServiceBusReceiver, ServiceBusReceiverOptions, ServiceBusSender, SubscribeOptions } from "@azure/service-bus";
import { ErrorHelper, IOperationResult, IPubSubManager, IPubSubMessage, PubSubReceiveMessageResult, PubSubSubscriptionState, PubSubSubscriptionStatus } from "tsdatautils-core";
import { PubSubMessageConverter } from "../converter/pubsub-message-converter";
import { AzurePubsubDocumentResult } from "../models/pub-sub-result";

class AzurePubSubSubscriber {
    public subscriptionId: string;
    public messageCallback: (message: any) => PubSubReceiveMessageResult;
    public errorCallback: (error: Error) => void;
}

export class AzurePubSubServiceBusQueueManager implements IPubSubManager {
    private serviceBusConnectionString: string = null;
    private queueName: string = null;
    private serviceBusClient: ServiceBusClient = null;
    private serviceBusSender: ServiceBusSender = null;
    private serviceBusSubscribers: AzurePubSubSubscriber[];
    private serviceBusReceiver: ServiceBusReceiver = null;

    public constructor(serviceBusConnectionString: string, queueName: string) {
        this.serviceBusConnectionString = serviceBusConnectionString;
        this.queueName = queueName;
    }

    public async initializeConnection(): Promise<void> {
        this.serviceBusSubscribers = [];
        this.serviceBusClient = null;
        this.serviceBusSender = null;
        this.serviceBusReceiver = null;
        if (this.serviceBusConnectionString && this.queueName) {
            this.serviceBusClient = new ServiceBusClient(this.serviceBusConnectionString);
            this.serviceBusSender = this.serviceBusClient.createSender(this.queueName);
        }       

        return;
    }

    public async publish<T>(message: T): Promise<IOperationResult> {
        let result: IOperationResult = AzurePubsubDocumentResult.buildSuccess();

        try {
            let converter: PubSubMessageConverter = new PubSubMessageConverter();
            let pubsubMessage: IPubSubMessage<T> = await converter.convertToMessage<T>(message);

            if (!this.serviceBusClient || !this.serviceBusSender) {
                result = AzurePubsubDocumentResult.buildSimpleError("Error publishing message to " + this.queueName + ": No service bus client configured or sender setup.", new Error("No service bus client configured or sender setup."));
                return result;
            }

            let serviceBusMessage: ServiceBusMessage = {
                body: JSON.stringify(pubsubMessage)
            };

            await this.serviceBusSender.sendMessages(serviceBusMessage);
        } catch (err) {
            result = AzurePubsubDocumentResult.buildSimpleError("Error publishing message to " + this.queueName + ": " + err, ErrorHelper.isError(err) ? err : new Error(err));
        }

        return result;
    }

    public async subscribe<T>(subscriberId: string, messageCallback: (message: T) => PubSubReceiveMessageResult, errorCallback: (error: Error) => void): Promise<IOperationResult> {
        let result: IOperationResult = AzurePubsubDocumentResult.buildSuccess();

        if (!this.serviceBusSubscribers) {
            this.serviceBusSubscribers = [];
        }

        let subscriberIndex: number = -1;
        for (let i = 0; i < this.serviceBusSubscribers.length; i++) {
            let subscriber: AzurePubSubSubscriber = this.serviceBusSubscribers[i];
            if (subscriber && subscriber.subscriptionId) {
                if (subscriber.subscriptionId === subscriberId) {
                    subscriberIndex = i;
                    break;
                }
            }
        }

        if (subscriberIndex !== -1) {
            result = AzurePubsubDocumentResult.buildSimpleError("Error subscribing to " + this.queueName + ": This subscriber id already exists.", new Error("This subscriber id already exists."));
            return result;
        }

        let newSubscriber: AzurePubSubSubscriber = new AzurePubSubSubscriber();
        newSubscriber.subscriptionId = subscriberId;
        newSubscriber.messageCallback = messageCallback;
        newSubscriber.errorCallback = errorCallback;

        this.serviceBusSubscribers.push(newSubscriber);

        try {
            await this.handleSubscriberChange();
        } catch (err) {
            result = AzurePubsubDocumentResult.buildSimpleError("Error subscribing to " + this.queueName + ": " + err, ErrorHelper.isError(err) ? err : new Error(err));
        }

        return result;
    }

    public async unsubscribe(subscriberId: string): Promise<IOperationResult> {
        let result: IOperationResult = AzurePubsubDocumentResult.buildSuccess();

        if (!this.serviceBusSubscribers) {
            this.serviceBusSubscribers = [];
        }

        let subscriberIndex: number = -1;
        for (let i = 0; i < this.serviceBusSubscribers.length; i++) {
            let subscriber: AzurePubSubSubscriber = this.serviceBusSubscribers[i];
            if (subscriber && subscriber.subscriptionId) {
                if (subscriber.subscriptionId === subscriberId) {
                    subscriberIndex = i;
                    break;
                }
            }
        }

        if (subscriberIndex === -1) {
            result = AzurePubsubDocumentResult.buildSimpleError("Error subscribing to " + this.queueName + ": This subscriber id does not exist.", new Error("This subscriber id does not exist."));
            return result;
        }

        this.serviceBusSubscribers.splice(subscriberIndex, 1);

        try {
            await this.handleSubscriberChange();
        } catch (err) {
            result = AzurePubsubDocumentResult.buildSimpleError("Error unsubscribing to " + this.queueName + ": " + err, ErrorHelper.isError(err) ? err : new Error(err));
        }

        return result;
    }

    private async handleSubscriberChange(): Promise<void> {
        if (this.serviceBusClient && this.queueName) {
            if (this.serviceBusReceiver) {
                if (!this.serviceBusSubscribers || this.serviceBusSubscribers.length === 0) {
                    await this.serviceBusReceiver.close();
                    this.serviceBusReceiver = null;
                }
            } else {
                if (this.serviceBusSubscribers && this.serviceBusSubscribers.length > 0) {
                    let serviceBusReceiverOptions: ServiceBusReceiverOptions = {};
                    serviceBusReceiverOptions.receiveMode = "peekLock";

                    this.serviceBusReceiver = this.serviceBusClient.createReceiver(this.queueName, serviceBusReceiverOptions);

                    let subscribeOptions: SubscribeOptions = {};
                    subscribeOptions.autoCompleteMessages = false;

                    await this.serviceBusReceiver.subscribe({
                        processMessage: (message: ServiceBusReceivedMessage) => {
                            return this.handleServiceBusMessage(message);
                        },
                        processError: (args: ProcessErrorArgs) => {
                            return this.handleServiceBusError(args);
                        }
                    }, subscribeOptions);
                }
            }
        }
    }

    private async handleServiceBusMessage(message: ServiceBusReceivedMessage): Promise<void> {
        try {
            let pubsubMessage: IPubSubMessage<any> = JSON.parse(message.body);

            let converter: PubSubMessageConverter = new PubSubMessageConverter();
            let containedMessage: any = await converter.convertFromMessage(pubsubMessage);

            let isHandled: boolean = this.sendSubscribersMessage(containedMessage);
            if (isHandled) {
                if (this.serviceBusReceiver) {
                    await this.serviceBusReceiver.completeMessage(message);
                }
            }
        } catch (err) {
            let messageErr: Error = ErrorHelper.isError(err) ? err : new Error("Error handling and completing service bus message for " + this.queueName + ": " + err);
            this.sendSubscribersError(messageErr);
        }
        
        return;
    }

    private async handleServiceBusError(args: ProcessErrorArgs): Promise<void> {
        this.sendSubscribersError(args.error);
        return;
    }

    private sendSubscribersMessage(message: any): boolean {
        let allHandled: boolean = true;
        for (let subscriber of this.serviceBusSubscribers) {
            let pubsubMessageReceiveResult: PubSubReceiveMessageResult = subscriber.messageCallback(message);

            if (!pubsubMessageReceiveResult.messageHandled) {
                allHandled = false;
            }
        }

        return allHandled;
    }

    private sendSubscribersError(err: Error): void {
        for (let subscriber of this.serviceBusSubscribers) {
            subscriber.errorCallback(err);
        }
    }

    public async closeConnection(): Promise<void> {
        // close receiver
        if (this.serviceBusReceiver) {
            await this.serviceBusReceiver.close();
        }
        
        // close sender
        if (this.serviceBusSender) {
            await this.serviceBusSender.close();
        }
        
        // close sb client
        if (this.serviceBusClient) {
            await this.serviceBusClient.close();
        }

        // null out other stuff
        this.serviceBusSubscribers = [];

        return;
    }

    public async getSubscriptionStatus(subscriberId: string): Promise<PubSubSubscriptionStatus> {
        let subscriptionStatus: PubSubSubscriptionStatus = new PubSubSubscriptionStatus();
        subscriptionStatus.state = PubSubSubscriptionState.Unknown;

        if (!this.serviceBusSubscribers) {
            this.serviceBusSubscribers = [];
        }

        let subscriberIndex: number = -1;
        let foundSubscriber: AzurePubSubSubscriber = null;
        for (let i = 0; i < this.serviceBusSubscribers.length; i++) {
            let subscriber: AzurePubSubSubscriber = this.serviceBusSubscribers[i];
            if (subscriber && subscriber.subscriptionId) {
                if (subscriber.subscriptionId === subscriberId) {
                    subscriberIndex = i;
                    foundSubscriber = subscriber;
                    break;
                }
            }
        }

        if (subscriberIndex === -1 || !foundSubscriber) {
            return null;
        }

        if (foundSubscriber && foundSubscriber.subscriptionId && this.serviceBusClient && this.serviceBusReceiver && !this.serviceBusReceiver.isClosed) {
            subscriptionStatus.state = PubSubSubscriptionState.Open;
        } else if (foundSubscriber && foundSubscriber.subscriptionId) {
            subscriptionStatus.state = PubSubSubscriptionState.Closed;
        }

        return subscriptionStatus;
    }
}