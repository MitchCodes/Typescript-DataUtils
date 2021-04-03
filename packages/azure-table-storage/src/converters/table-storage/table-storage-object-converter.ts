import { TableStorageObjectConverter } from "../../models/table-storage-object-converter";

export class TableStorageObjectTypeConverter extends TableStorageObjectConverter {
    public constructor() {
        super();

        this.convertToAzure = (input: any) => {
            let objectKeys: string[] = Object.keys(input);
            if (objectKeys) {
                for (let objectKey of objectKeys) {
                    if (input[objectKey] && this.isObjectToConvert(input[objectKey])) {
                        input[objectKey] = "$_$TS_OBJECT$_$:" + JSON.stringify(input[objectKey]);
                    }
                }
            }
            return input;
        };

        this.convertFromAzure = (input: any) => {
            let objectKeys: string[] = Object.keys(input);
            if (objectKeys) {
                for (let objectKey of objectKeys) {
                    if (input[objectKey] && this.isString(input[objectKey]) && (<string>input[objectKey]).startsWith("$_$TS_OBJECT$_$:")) {
                        let arrJson: string = (<string>input[objectKey]).replace("$_$TS_OBJECT$_$:", "");
                        input[objectKey] = JSON.parse(arrJson);
                    }
                }
            }
            return input;
        };
    }

    private isObjectToConvert(input: any): boolean {
        if (this.isObject(input)) {
            if (!this.isArray(input) && !this.isDate(input)) {
                return true;
            }
        }

        return false;
    }

    private isDate(input: any): boolean {
        let keyType = typeof input;
        if (keyType === 'object') {
            if (input instanceof Date) {
                return true;
            }
        }
        return false;
    }

    private isArray(input: any): boolean {
        return input !== null && Array.isArray(input);
    }

    private isObject(input: any): boolean {
        return typeof input === 'object' && input !== null;
    }

    private isString(input: any): boolean {
        return typeof input === 'string' || input instanceof String;
    }
}