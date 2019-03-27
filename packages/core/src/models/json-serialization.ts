export interface IJsonParser {
    parse(text: string, reviver?: (key: any, value: any) => any): any;
}

export interface IJsonStringifier {
    stringify(value: any, replacer?: (key: string, value: any) => any, space?: string | number): string;
}

export interface IJsonPropertyHandler {
    canHandleStringify(obj: any, propertyKey: string, propertyValue: any): boolean;
    handlePropertyPreStringify(obj: any, propertyKey: string, propertyValue: any): void;
    handlePropertyPostStringify(obj: any, propertyKey: string, propertyValue: any): void;
    canHandleParse(obj: any, propertyKey: string, propertyValue: any): boolean;
    handlePropertyPostParse(obj: any, propertyKey: string, propertyValue: any): void;
}
