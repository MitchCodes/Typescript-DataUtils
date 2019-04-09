export class BlobInfo {
    public name: string;
    public containerName: string;
    public contentLength: string;
    public contentEncoding: string;
    public contentType: string;
    public creationTime: Date;
    public deleted: boolean;
    public deletedTime: Date;
    public lastModifiedTime: Date;

    public constructor() {
        this.deleted = false;
    }
}
