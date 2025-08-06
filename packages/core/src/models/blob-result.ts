import { BlobInfo } from './blob-info';

export class BlobResult {
    public stream: NodeJS.ReadableStream;
    public info: BlobInfo;

    public constructor() {
        this.info = new BlobInfo();
    }
}