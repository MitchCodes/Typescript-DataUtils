export interface DocumentIdentifier {
    partitionKey: string;
    rowKey: string;
}

// tslint:disable-next-line:max-classes-per-file no-unnecessary-class
export class BasicDocumentIdentifier implements DocumentIdentifier {
    public partitionKey: string;
    public rowKey: string;

    get cacheKey(): string {
        return this.partitionKey + '_' + this.rowKey;
    }

    public constructor(partitionKey: string, rowKey: string) {
        this.partitionKey = partitionKey;
        this.rowKey = rowKey;
    }
}
