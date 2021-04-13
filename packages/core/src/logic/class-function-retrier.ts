import { FunctionHelper } from "../main";
import { ErrorHelper } from "./helpers/error.helper";

export class ClassFunctionRetrier {
    public getRetryableClass<T>(obj: T, maxRetryAmount: number, maxRetryReturn: (error: any, functionName: string) => any = null, errorCallback: (error: any) => void = null): T {
        let newObj = {};
        newObj['$obj'] = obj;

        if (maxRetryReturn === null) {
            maxRetryReturn = (error: any, functionName: string): any => {
                throw error;
            };
        }

        let functionHelper: FunctionHelper = new FunctionHelper();
        let functions: string[] = functionHelper.getAllFunctions(obj, true);
        for (let key of functions) {
            if (obj[key] && typeof obj[key] === 'function') {
                newObj[key] = (...args) => {
                    if (obj[key]) {
                        let retries: number = 0;
                        let lastError: any = null;
                        let returnObj: any = null;

                        while (retries < maxRetryAmount) {
                            try {
                                returnObj = obj[key].apply(obj, args);
                                break;
                            } catch (err) {
                                lastError = err;

                                if (errorCallback) {
                                    errorCallback(err);
                                }

                                retries = retries + 1;
                            }
                        }

                        if (retries >= maxRetryAmount) {
                            if (maxRetryReturn) {
                                returnObj = maxRetryReturn(lastError, key);
                            } else {
                                if (ErrorHelper.isError(lastError)) {
                                    throw lastError;
                                } else {
                                    throw new Error(lastError);
                                }
                            }
                        }

                        return returnObj;
                    } else {
                        return null;
                    }
                };
            } else {
                newObj[key] = null;
            }
        }

        return <T>newObj;
    }

    public getRetryableClassAsync<T>(obj: T, maxRetryAmount: number, maxRetryReturn: (error: any, functionName: string) => any = null, errorCallback: (error: any) => void = null): T {
        let newObj = {};
        newObj['$obj'] = obj;

        if (maxRetryReturn === null) {
            maxRetryReturn = (error: any, functionName: string): any => {
                throw error;
            };
        }

        let functionHelper: FunctionHelper = new FunctionHelper();
        let functions: string[] = functionHelper.getAllFunctions(obj, true);
        for (let key of functions) {
            if (obj[key] && typeof obj[key] === 'function') {
                newObj[key] = async (...args) => {
                    if (obj[key]) {
                        let retries: number = 0;
                        let lastError: any = null;
                        let returnObj: any = null;

                        while (retries < maxRetryAmount) {
                            try {
                                returnObj = await obj[key].apply(obj, args);
                                break;
                            } catch (err) {
                                lastError = err;

                                if (errorCallback) {
                                    errorCallback(err);
                                }

                                retries = retries + 1;
                            }
                        }

                        if (retries >= maxRetryAmount) {
                            if (maxRetryReturn) {
                                returnObj = maxRetryReturn(lastError, key);
                            } else {
                                if (ErrorHelper.isError(lastError)) {
                                    throw lastError;
                                } else {
                                    throw new Error(lastError);
                                }
                            }
                        }

                        return returnObj;
                    } else {
                        return null;
                    }
                };
            } else {
                newObj[key] = null;
            }
        }

        return <T>newObj;
    }
}