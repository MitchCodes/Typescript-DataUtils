import { IQueueMessage } from "tsdatautils-core";

export class QueueMessage<T> implements IQueueMessage<T> {
    base64: boolean;
    gzip: boolean;
    msg: string;
}