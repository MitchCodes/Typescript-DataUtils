import { IClassFunctionDistributor, IClassFunctionDistributorAlgorithm, IClassFunctionDistributorCreator } from "../models/class-function-distribute";
import { FunctionHelper } from "./helpers/function.helper";

export class RoundRobinClassFunctionDistributorAlgorithm implements IClassFunctionDistributorAlgorithm {
    getNextInstance<T>(input: T & IClassFunctionDistributor<T>, calculateNewInstance: boolean): T {
        let inputAny: any = <any>input;
        if (inputAny.currentInstanceIndex === undefined || inputAny.currentInstanceIndex === null) {
            inputAny.currentInstanceIndex = -1;
        }
        
        if (calculateNewInstance) {
            let newInstanceIndex: number = inputAny.currentInstanceIndex + 1;
            let numberOfInstances: number = input.instances.length;
            if (newInstanceIndex >= numberOfInstances) {
                newInstanceIndex = 0;
            }

            inputAny.currentInstanceIndex = newInstanceIndex;
        } else {
            if (inputAny.currentInstanceIndex < 0) {
                inputAny.currentInstanceIndex = 0;
            }
        }

        return input.instances[inputAny.currentInstanceIndex];
    }
}

export class RandomClassFunctionDistributorAlgorithm implements IClassFunctionDistributorAlgorithm {
    getNextInstance<T>(input: T & IClassFunctionDistributor<T>, calculateNewInstance: boolean): T {
        let inputAny: any = <any>input;
        if (inputAny.currentInstanceIndex === undefined || inputAny.currentInstanceIndex === null) {
            inputAny.currentInstanceIndex = -1;
        }
        
        if (calculateNewInstance) {
            let newInstanceIndex: number = Math.floor(Math.random() * input.instances.length);

            inputAny.currentInstanceIndex = newInstanceIndex;
        } else {
            if (inputAny.currentInstanceIndex < 0) {
                inputAny.currentInstanceIndex = 0;
            }
        }

        return input.instances[inputAny.currentInstanceIndex];
    }
}

export class ClassFunctionDistributorCreator implements IClassFunctionDistributorCreator {
    public getDistributedObject<T>(instances: T[], algorithm: IClassFunctionDistributorAlgorithm, type: new () => T = null): T & IClassFunctionDistributor<T> {
        if (type === null && instances.length === 0) {
            throw new Error('Need at least one instance to get a distributed object if no type initializer is provided');
        }

        let objToGetFunctions: T = null;
        let newObj: T & IClassFunctionDistributor<T> = null;
        if (type === null) {
            newObj = <T & IClassFunctionDistributor<T>>Object.assign({}, instances[0]);
            objToGetFunctions = instances[0];
        } else {
            newObj = (<T & IClassFunctionDistributor<T>>(new type()));
            objToGetFunctions = newObj;
        }

        newObj.instances = instances;
        newObj.addInstance = (instance: T): void => {
            newObj.instances.push(instance);
        };

        newObj.removeInstance = (instance: T): void => {
            let index: number = newObj.instances.indexOf(instance);
            if (index !== -1) {
                newObj.instances.splice(index, 1);
            }
        };

        newObj.getNextInstance = (calculateNewInstance: boolean = true): T => {
            return algorithm.getNextInstance(newObj, calculateNewInstance);
        };        

        let functionHelper: FunctionHelper = new FunctionHelper();
        let functions: string[] = functionHelper.getAllFunctions(objToGetFunctions, true);
        for (let key of functions) {
            if (objToGetFunctions[key] && typeof objToGetFunctions[key] === 'function') {
                newObj[key] = (...args) => {
                    let instance: any = newObj.getNextInstance(true);
                    if (instance[key]) {
                        return instance[key].apply(instance, args);
                    } else {
                        return null;
                    }
                };
            } else {
                newObj[key] = null;
            }
        }

        return (<T & IClassFunctionDistributor<T>>newObj);
    }
}
