import { IPubSubMessage } from "tsdatautils-core";
import { PubSubMessage } from "../models/pub-sub-message";
import { Base64 } from "js-base64";

export class PubSubMessageConverter {
    public async convertToMessage<T>(input: T): Promise<IPubSubMessage<T>> {
        let queueMessage: PubSubMessage<T> = new PubSubMessage<T>();

        let inputAsString: string = JSON.stringify(input);

        let finalMsg: string = Base64.encode(inputAsString);

        queueMessage.msg = finalMsg;

        return queueMessage;
    }

    public async convertFromMessage<T>(input: IPubSubMessage<T>): Promise<T> {
        if (input) {
            let inputUnbase64: string | Uint8Array = Base64.decode(input.msg);

            let inputAsT: T = <T>JSON.parse(inputUnbase64);
            
            if (inputAsT) {
                return inputAsT;
            } else {
                return null;
            }
        } else {
            return null;
        }
    }
}