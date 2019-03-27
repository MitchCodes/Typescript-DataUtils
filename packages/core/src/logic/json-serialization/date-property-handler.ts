import { IJsonPropertyHandler } from '../../models/json-serialization';

export class DateJsonPropertyHandler implements IJsonPropertyHandler {

    public canHandleStringify(obj: any, propertyKey: string, propertyValue: any): boolean {
        if (propertyValue instanceof Date) {
            return true;
        }
        
        return false;
    }

    public handlePropertyPreStringify(obj: any, propertyKey: string, propertyValue: any): void {
        let metadataPropKey: string = '$serialize_' + propertyKey;
        let metadataPropVal: any = {
            type: 'date',
        };

        obj[metadataPropKey] = metadataPropVal;
    }

    public handlePropertyPostStringify(obj: any, propertyKey: string, propertyValue: any): void {
        let metadataPropKey: string = '$serialize_' + propertyKey;

        delete obj[metadataPropKey];
    }

    public canHandleParse(obj: any, propertyKey: string, propertyValue: any): boolean {
        let metadataPropKey: string = '$serialize_' + propertyKey;
        let metadata: any = obj[metadataPropKey];
        if (metadata !== undefined && metadata !== null && metadata.type !== undefined && metadata.type !== null) {
            if (metadata.type === 'date') {
                return true;
            }
        }

        return false;
    }   

    public handlePropertyPostParse(obj: any, propertyKey: string, propertyValue: any): void {
        obj[propertyKey] = new Date((<string>propertyValue));

        // cleanup metadata
        let metadataPropKey: string = '$serialize_' + propertyKey;
        delete obj[metadataPropKey];
    }

}
