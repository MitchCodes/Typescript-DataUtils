import { IJsonStringifier, IJsonParser, IJsonPropertyHandler } from '../../models/json-serialization';
import { DateJsonPropertyHandler } from './date-property-handler';
import { UndefinedJsonPropertyHandler } from './undefined-property-handler';

export class JsonSerializer implements IJsonStringifier, IJsonParser {
    public propertyHandlers: IJsonPropertyHandler[];

    public constructor(propertyHandlers: IJsonPropertyHandler[] = null) {
        if (propertyHandlers === null) {
            this.propertyHandlers = [];
            this.propertyHandlers.push(new DateJsonPropertyHandler());
            //this.propertyHandlers.push(new UndefinedJsonPropertyHandler());
        } else {
            this.propertyHandlers = propertyHandlers;
        }
    }

    public stringify(value: any, replacer?: (key: string, value: any) => any, space?: string | number): string {
        this.preStringifyForObjHandlers(value);
        let stringifiedObj: string = JSON.stringify(value, replacer, space);
        this.postStringifyForObjHandlers(value);

        return stringifiedObj;
    }

    public parse(text: string, reviver?: (key: any, value: any) => any) {
        let parsedObj: any = JSON.parse(text, reviver);
        this.postParseForObjHandlers(parsedObj);

        return parsedObj;
    }

    private preStringifyForObjHandlers(obj: any): void {
        let objPropKeys: string[] = Object.keys(obj);

        for (let objKey of objPropKeys) {
            let prop = obj[objKey];
            let propType = typeof prop;

            for (let propertyHandler of this.propertyHandlers) {
                let propHandled: boolean = false;
                if (propertyHandler.canHandleStringify(obj, objKey, prop)) {
                    propertyHandler.handlePropertyPreStringify(obj, objKey, prop);
                    propHandled = true;
                }
                if (propHandled) {
                    continue;
                }
            }

            if (propType === 'object') {
                this.preStringifyForObjHandlers(prop);
            }
        }
    }

    private postStringifyForObjHandlers(obj: any): void {
        let objPropKeys: string[] = Object.keys(obj);

        for (let objKey of objPropKeys) {
            let prop = obj[objKey];
            let propType = typeof prop;

            for (let propertyHandler of this.propertyHandlers) {
                let propHandled: boolean = false;
                if (propertyHandler.canHandleStringify(obj, objKey, prop)) {
                    propertyHandler.handlePropertyPostStringify(obj, objKey, prop);
                    propHandled = true;
                }
                if (propHandled) {
                    continue;
                }
            }

            if (propType === 'object') {
                this.preStringifyForObjHandlers(prop);
            }
        }
    }

    private postParseForObjHandlers(obj: any): void {
        let objPropKeys: string[] = Object.keys(obj);

        for (let objKey of objPropKeys) {
            let prop = obj[objKey];
            let propType = typeof prop;

            for (let propertyHandler of this.propertyHandlers) {
                let propHandled: boolean = false;
                if (propertyHandler.canHandleParse(obj, objKey, prop)) {
                    propertyHandler.handlePropertyPostParse(obj, objKey, prop);
                    propHandled = true;
                }
                if (propHandled) {
                    continue;
                }
            }

            if (propType === 'object') {
                this.postParseForObjHandlers(prop);
            }
        }
    }
    
}
