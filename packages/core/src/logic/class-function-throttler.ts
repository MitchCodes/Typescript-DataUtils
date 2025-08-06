import { default as pThrottle } from 'p-throttle';
import { FunctionHelper } from './helpers/function.helper';

export class ClassFunctionThrottler {
    public getThrottledClass<T>(obj: T, limit: number, intervalMs: number, strictThrottleAlgorithm: boolean = false): T {
        const newObj = {};
        newObj['$obj'] = obj;

        const throttle = pThrottle({
            limit: limit,
            interval: intervalMs,
            strict: strictThrottleAlgorithm
        });

        const throttleFn = throttle((args: any[], obj: Object, funcName: string, thisArg: any) => {
            return obj[funcName].apply(thisArg, args);
        })

        const functionHelper: FunctionHelper = new FunctionHelper();
        const functions: string[] = functionHelper.getAllFunctions(obj, true);
        for (const key of functions) {
            if (obj[key] && typeof obj[key] === 'function') {
                newObj[key] = (...args) => {
                    return throttleFn(args, obj, key, newObj['$obj']);
                };
            } else {
                newObj[key] = null;
            }
        }

        return <T>newObj;
    }
}