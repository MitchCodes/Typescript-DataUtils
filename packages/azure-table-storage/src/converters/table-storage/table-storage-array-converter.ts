import { TableStorageObjectConverter } from "../../models/table-storage-object-converter";

export class TableStorageArrayConverter extends TableStorageObjectConverter {
    public constructor() {
        super();

        this.convertToAzure = (input: any) => {
            let objectKeys: string[] = Object.keys(input);
            if (objectKeys) {
                for (let objectKey of objectKeys) {
                    if (input[objectKey] && this.isArray(input[objectKey])) {
                        input[objectKey] = "$_$TS_ARRAY$_$:" + JSON.stringify(input[objectKey]);
                    }
                }
            }
            return input;
        };

        this.convertFromAzure = (input: any) => {
            let objectKeys: string[] = Object.keys(input);
            if (objectKeys) {
                for (let objectKey of objectKeys) {
                    if (input[objectKey] && this.isString(input[objectKey]) && (<string>input[objectKey]).startsWith("$_$TS_ARRAY$_$:")) {
                        let arrJson: string = (<string>input[objectKey]).replace("$_$TS_ARRAY$_$:", "");
                        input[objectKey] = JSON.parse(arrJson);
                    }
                }
            }
            return input;
        };
    }

    private isArray(input: any): boolean {
        return input !== null && Array.isArray(input);
    }

    private isString(input: any): boolean {
        return typeof input === 'string' || input instanceof String;
    }
}