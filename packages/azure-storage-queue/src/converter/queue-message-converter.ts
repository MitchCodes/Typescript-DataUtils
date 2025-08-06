import { IQueueMessage, QueueMessageOptions } from "tsdatautils-core";
import { QueueMessage } from "../models/queue-message";
import { gzip, ungzip } from 'node-gzip';
import { Base64 } from 'js-base64';

export class QueueMessageConverter {
    public async convertToMessage<T>(input: T, options: QueueMessageOptions = null): Promise<IQueueMessage<T>> {
        const queueMessage: QueueMessage<T> = new QueueMessage<T>();

        if (!options) {
            options = new QueueMessageOptions();
        }

        if (options.gzipCompress && !options.convertToBase64) {
            options.convertToBase64 = true;
        }

        queueMessage.base64 = options.convertToBase64;
        queueMessage.gzip = options.gzipCompress;
        


        const inputAsString: string = JSON.stringify(input);

        let inputCompressed: string | Buffer = inputAsString;
        if (options.gzipCompress) {
            inputCompressed = await gzip(inputCompressed);
        }

        // figure out how to do this between byte arrays and strings. options between compression and decompression
        let finalMsg: string = '';
        if (inputCompressed instanceof Buffer) {
            if (options.convertToBase64) {
                finalMsg = Base64.fromUint8Array(inputCompressed);
            } else {
                finalMsg = inputCompressed.toString();
            }
        } else {
            const inputString = inputCompressed as string;
            if (options.convertToBase64) {
                finalMsg = Base64.encode(inputString);
            } else {
                finalMsg = inputString;
            }
        }

        queueMessage.msg = finalMsg;

        return queueMessage;
    }

    public async convertFromMessage<T>(input: IQueueMessage<T>): Promise<T> {
        if (input) {

            let inputUnbase64: string | Uint8Array = input.msg;
            if (input.base64) {
                if (input.gzip) {
                    inputUnbase64 = Base64.toUint8Array(input.msg);
                } else {
                    inputUnbase64 = Base64.decode(input.msg);
                }
            } else {
                inputUnbase64 = inputUnbase64;
            }

            let inputUngzip: string = null;
            if (input.gzip) {
                const unGzippedBuffer: any = await ungzip(inputUnbase64);
                inputUngzip = Buffer.from(unGzippedBuffer).toString();
            } else {
                inputUngzip = <string>inputUnbase64;
            }

            const inputAsT: T = <T>JSON.parse(inputUngzip);
            
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