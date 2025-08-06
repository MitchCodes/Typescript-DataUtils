import { IJsonPropertyHandler } from '../../models/json-serialization';

export class DateJsonPropertyHandler implements IJsonPropertyHandler {

    public canHandleStringify(obj: any, propertyKey: string, propertyValue: any): boolean {
        if (propertyValue instanceof Date) {
            return true;
        }
        
        return false;
    }

    public handlePropertyPreStringify(obj: any, propertyKey: string, propertyValue: any): void {
        const metadataPropKey: string = '$serialize_' + propertyKey;
        const metadataPropVal: any = {
            type: 'date',
        };

        obj[metadataPropKey] = metadataPropVal;
    }

    public handlePropertyPostStringify(obj: any, propertyKey: string, propertyValue: any): void {
        const metadataPropKey: string = '$serialize_' + propertyKey;

        delete obj[metadataPropKey];
    }

    public canHandleParse(obj: any, propertyKey: string, propertyValue: any): boolean {
        const metadataPropKey: string = '$serialize_' + propertyKey;
        const metadata: any = obj[metadataPropKey];
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
        const metadataPropKey: string = '$serialize_' + propertyKey;
        delete obj[metadataPropKey];
    }

}
