export class BlobInfo {
    name: string;
    containerName: string;
    contentLength: string;
    creationTime: Date;
    deleted: boolean;
    deletedTime: Date;
    lastModifiedTime: Date;

    public constructor() {
        this.deleted = false;
    }
}
