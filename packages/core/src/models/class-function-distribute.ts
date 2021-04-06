export interface IClassFunctionDistributor<T> {
    instances: T[];
    getNextInstance(calculateNewInstance: boolean): T;
    addInstance(instance: T): void;
    removeInstance(instance: T): void;
}

export interface IClassFunctionDistributorAlgorithm {
    getNextInstance<T>(input: T & IClassFunctionDistributor<T>, calculateNewInstance: boolean): T;
}

export interface IClassFunctionDistributorCreator {
    getDistributedObject<T>(instances: T[], algorithm: IClassFunctionDistributorAlgorithm, type: new () => T): T & IClassFunctionDistributor<T>;
}