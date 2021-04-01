import { default as pThrottle } from 'p-throttle';

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

        let functions: string[] = this.excludeCommonFuncs(this.getAllFuncs(obj));
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

    private getAllFuncs(toCheck): string[] {
        var props = [];
        var obj = toCheck;
        do {
            props = props.concat(Object.getOwnPropertyNames(obj));
        } while (obj = Object.getPrototypeOf(obj));
    
        return props.sort().filter(function(e, i, arr) { 
            if (e!=arr[i+1] && typeof toCheck[e] == 'function') {
                return true;
            } else {
                return false;
            }
        });
    }

    private excludeCommonFuncs(allFuncs: string[]): string[] {
        let returnFunctions: string[] = [];

        let commonFunctions: string[] = [
            '__defineGetter__',
            '__defineSetter__',
            '__lookupGetter__',
            '__lookupSetter__',
            'constructor',
            'hasOwnProperty',
            'isPrototypeOf',
            'propertyIsEnumerable',
            'toLocaleString',
            'toString',
            'valueOf'
        ];
        
        for(let func of allFuncs) {
            if (commonFunctions.indexOf(func) === -1) {
                returnFunctions.push(func);
            }
        }

        return returnFunctions;
    }
}