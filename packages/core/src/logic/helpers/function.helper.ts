export class FunctionHelper {
    public getAllFunctions(mainObj: any, excludeCommonFunctions: boolean = true): string[] {
        var props = [];
        var obj = mainObj;
        do {
            props = props.concat(Object.getOwnPropertyNames(obj));
        } while (obj = Object.getPrototypeOf(obj));
    
        let allFunctions: string[] = props.sort().filter(function(e, i, arr) { 
            if (e!=arr[i+1] && typeof mainObj[e] == 'function') {
                return true;
            } else {
                return false;
            }
        });

        return excludeCommonFunctions ? this.excludeCommonFuncs(allFunctions) : allFunctions;
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