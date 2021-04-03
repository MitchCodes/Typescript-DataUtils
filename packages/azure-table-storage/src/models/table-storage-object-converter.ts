export class TableStorageObjectConverter {
    public convertToAzure: (input: any) => any = null;
    public convertFromAzure: (input: any) => any = null;

    public constructor(convertTo: (input: any) => any = null, convertFrom: (input: any) => any = null) {
        if (convertTo) {
            this.convertToAzure = convertTo;
        }

        if (convertFrom) {
            this.convertFromAzure = convertFrom;
        }
    }
}
