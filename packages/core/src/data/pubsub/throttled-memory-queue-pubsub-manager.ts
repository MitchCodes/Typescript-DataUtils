import { default as pThrottle } from 'p-throttle';
import { ErrorHelper } from '../../logic/helpers/error.helper';
import { IOperationResult } from '../../models/operation-result';
import { IPubSubManager, PubSubSubscriptionState, PubSubSubscriptionStatus } from '../../models/pub-sub-manager';
import { PubsubDocumentResult, PubSubReceiveMessageResult } from '../../models/pub-sub-message';

class ThrottlePubSubSubscriber {
    public subscriptionId: string;
    public messageCallback: (message: any) => PubSubReceiveMessageResult;
    public errorCallback: (error: Error) => void;
}

export class ThrottledMemoryQueuePubSubManager implements IPubSubManager {
    private limit: number;
    private intervalMs: number;
    private useStrictAlgorithm: boolean;
    private subscribers: ThrottlePubSubSubscriber[];
    private throttle: any = null;
    private throttleFn: any = null;

    public constructor(limit: number, intervalMs: number, useStrictAlgorithm: boolean = false) {
        this.limit = limit;
        this.intervalMs = intervalMs;
        this.useStrictAlgorithm = useStrictAlgorithm;
    }

    public async initializeConnection(): Promise<void> {
        this.subscribers = [];

        this.throttle = pThrottle({
            limit: this.limit,
            interval: this.intervalMs,
            strict: this.useStrictAlgorithm
        });

        this.throttleFn = this.throttle((message: any) => {
            return Promise.resolve(message);
        });
    }

    public async publish<T>(message: T): Promise<IOperationResult> {
        let result: IOperationResult = PubsubDocumentResult.buildSuccess();

        try {
            if (!this.throttleFn) {
                result = PubsubDocumentResult.buildSimpleError("No existing throttle queue. Is it initialized?", new Error("No existing throttle queue. Is it initialized?"));
                return result;
            }

            this.throttleFn(message).then((message: any) => {
                this.handleDequeue(message);
            })
        } catch (err) {
            result = PubsubDocumentResult.buildSimpleError("Error publishing to throttled queue: " + err, ErrorHelper.isError(err) ? err : new Error(err));
            return result;
        }

        return result;
    }

    public async subscribe<T>(subscriberId: string, messageCallback: (message: T) => PubSubReceiveMessageResult, errorCallback: (err: Error) => void): Promise<IOperationResult> {
        let result: IOperationResult = PubsubDocumentResult.buildSuccess();

        if (!this.subscribers) {
            this.subscribers = [];
        }

        let subscriberIndex: number = -1;
        for (let i = 0; i < this.subscribers.length; i++) {
            let subscriber: ThrottlePubSubSubscriber = this.subscribers[i];
            if (subscriber && subscriber.subscriptionId) {
                if (subscriber.subscriptionId === subscriberId) {
                    subscriberIndex = i;
                    break;
                }
            }
        }

        if (subscriberIndex !== -1) {
            result = PubsubDocumentResult.buildSimpleError("Error subscribing to throttled queue: This subscriber id already exists.", new Error("This subscriber id already exists."));
            return result;
        }

        let newSubscriber: ThrottlePubSubSubscriber = new ThrottlePubSubSubscriber();
        newSubscriber.subscriptionId = subscriberId;
        newSubscriber.messageCallback = messageCallback;
        newSubscriber.errorCallback = errorCallback;

        this.subscribers.push(newSubscriber);

        return result;
    }

    public async unsubscribe(subscriberId: string): Promise<IOperationResult> {
        let result: IOperationResult = PubsubDocumentResult.buildSuccess();

        if (!this.subscribers) {
            this.subscribers = [];
        }

        let subscriberIndex: number = -1;
        for (let i = 0; i < this.subscribers.length; i++) {
            let subscriber: ThrottlePubSubSubscriber = this.subscribers[i];
            if (subscriber && subscriber.subscriptionId) {
                if (subscriber.subscriptionId === subscriberId) {
                    subscriberIndex = i;
                    break;
                }
            }
        }

        if (subscriberIndex === -1) {
            result = PubsubDocumentResult.buildSimpleError("Error subscribing to throttled queue: This subscriber id does not exist.", new Error("This subscriber id does not exist."));
            return result;
        }

        this.subscribers.splice(subscriberIndex, 1);

        return result;
    }

    public async getSubscriptionStatus(subscriberId: string): Promise<PubSubSubscriptionStatus> {
        let subscriptionStatus: PubSubSubscriptionStatus = new PubSubSubscriptionStatus();
        subscriptionStatus.state = PubSubSubscriptionState.Unknown;

        if (!this.subscribers) {
            this.subscribers = [];
        }

        let subscriberIndex: number = -1;
        let foundSubscriber: ThrottlePubSubSubscriber = null;
        for (let i = 0; i < this.subscribers.length; i++) {
            let subscriber: ThrottlePubSubSubscriber = this.subscribers[i];
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

        if (foundSubscriber && foundSubscriber.subscriptionId && this.throttleFn) {
            subscriptionStatus.state = PubSubSubscriptionState.Open;
        } else if (foundSubscriber && foundSubscriber.subscriptionId) {
            subscriptionStatus.state = PubSubSubscriptionState.Closed;
        }

        return subscriptionStatus;
    }

    private async handleDequeue(message: any): Promise<void> {
        try {
            let isHandled: boolean = this.sendSubscribersMessage(message);
            if (!isHandled) {
                this.sendSubscribersError(new Error("Not all subscribers handled throttled queue message"));
            }
        } catch (err) {
            let messageErr: Error = ErrorHelper.isError(err) ? err : new Error("Error handling and completing service bus message for throttled queue: " + err);
            this.sendSubscribersError(messageErr);
        }
        
        return;
    }

    private sendSubscribersMessage(message: any): boolean {
        let allHandled: boolean = true;
        for (let subscriber of this.subscribers) {
            let pubsubMessageReceiveResult: PubSubReceiveMessageResult = subscriber.messageCallback(message);

            if (!pubsubMessageReceiveResult.messageHandled) {
                allHandled = false;
            }
        }

        return allHandled;
    }

    private sendSubscribersError(err: Error): void {
        for (let subscriber of this.subscribers) {
            subscriber.errorCallback(err);
        }
    }

    public async closeConnection(): Promise<void> {
        if (this.throttleFn) {
            this.throttleFn.abort();
        }

        if (this.throttle) {
            this.throttle = null;
        }

        this.subscribers = [];
    }
}