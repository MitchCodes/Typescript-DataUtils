import { IPubSubMessage } from "tsdatautils-core";

export class PubSubMessage<T> implements IPubSubMessage<T> {
    base64: boolean;
    gzip: boolean;
    msg: string;
}