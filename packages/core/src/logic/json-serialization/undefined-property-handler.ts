import { IJsonPropertyHandler } from '../../models/json-serialization';

export class UndefinedJsonPropertyHandler implements IJsonPropertyHandler {

    public canHandleStringify(obj: any, propertyKey: string, propertyValue: any): boolean {
        if (propertyValue === undefined) {
            return true;
        }
 
        return false;
    }
    
    public handlePropertyPreStringify(obj: any, propertyKey: string, propertyValue: any): void {
        const metadataPropKey: string = '$serialize_' + propertyKey;
        const metadataPropVal: any = {
            $serialize_key: propertyKey,
            type: 'undefined',
        };

        obj[metadataPropKey] = metadataPropVal;
    }

    public handlePropertyPostStringify(obj: any, propertyKey: string, propertyValue: any): void {
        const metadataPropKey: string = '$serialize_' + propertyKey;

        delete obj[metadataPropKey];
    }

    public canHandleParse(obj: any, propertyKey: string, propertyValue: any): boolean {
        if (propertyValue !== undefined && propertyValue !== null && propertyValue.$serialize_key !== undefined) {
            if (propertyValue.type !== undefined && propertyValue.type !== null && propertyValue.type === 'undefined') {
                return true;
            }
        }

        return false;
    }

    public handlePropertyPostParse(obj: any, propertyKey: string, propertyValue: any): void {
        const undefinedProp: string = propertyValue.$serialize_key;
        
        obj[undefinedProp] = undefined;

        delete obj[propertyKey];
    }

}
