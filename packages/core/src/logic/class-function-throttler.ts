import { default as pThrottle } from 'p-throttle';
import { FunctionHelper } from './helpers/function.helper';

export class ClassFunctionThrottler {
    public getThrottledClass<T>(obj: T, limit: number, intervalMs: number, strictThrottleAlgorithm: boolean = false): T {
        let newObj = {};
        newObj['$obj'] = obj;

        let throttle = pThrottle({
            limit: limit,
            interval: intervalMs,
            strict: strictThrottleAlgorithm
        });

        let throttleFn = throttle((args: any[], obj: Object, funcName: string, thisArg: any) => {
            return obj[funcName].apply(thisArg, args);
        })

        let functionHelper: FunctionHelper = new FunctionHelper();
        let functions: string[] = functionHelper.getAllFunctions(obj, true);
        for (let key of functions) {
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