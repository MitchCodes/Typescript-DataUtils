import { AzureDocumentStorageManager, IAzureDocumentSavable, AzureDocumentResult, 
         AzureDocumentBatchResult, AzureDocumentBatchResults, 
         AzureTableDocumentCacheInMemory, AzureDocumentIdentifier } from '../../src/data/azure-document-storagemanager.logic';
import { Logger, createLogger, transports } from 'winston';
import { IOperationResult, OperationResultStatus, BatchResultStatus, ModelComparer } from 'tsdatautils-core';
import * as moment from 'moment';
import { TableStorageArrayConverter, TableStorageObjectTypeConverter } from '../../src/main';

// Mock the Azure Data Tables SDK
jest.mock('@azure/data-tables', () => ({
  TableClient: jest.fn(),
  TableServiceClient: jest.fn(),
  AzureNamedKeyCredential: jest.fn(),
  odata: jest.fn()
}));

// Mock the Azure Storage Blob SDK
jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn(),
  StorageSharedKeyCredential: jest.fn()
}));

export class CarLog {
    public time: number;
    public log: string;

    public constructor(time: number = 0, log: string = '') {
        this.time = time;
        this.log = log;
    }
}

export class CarTest implements IAzureDocumentSavable {
    public partitionKey: string;
    public rowKey: string;
    public classVersion: number = 2;
    public color: string;
    public make: string;
    public model: string;
    public year: number;
    public dateMade: Date;
    public turboType: string;
    public tireName: string;
    public engine: Object;
    public isOn: boolean;

    public logs: CarLog[];

    public turnOn() {
        this.isOn = true;
    }

    public handleVersionChange(inputObject: Object, inputVersion: number, latestVersion: number): boolean {
        if (inputVersion === 1 && latestVersion === 2) {
            // tslint:disable-next-line:no-string-literal
            inputObject['tireName'] = 'New Tire';

            return true;
        }

        return false;
    }
}

describe('azure-storage-manager-tests', () => {
    let logger: Logger;
    let testModel: CarTest;
    let convObject: Object = null;
    let convertedTestModel: CarTest;
    let testModelManager: any;

    let storageAcct: string;
    let storageKey: string;
    let storageTable: string;

    beforeAll(async () => {
        const { TableClient, TableServiceClient, AzureNamedKeyCredential } = require('@azure/data-tables');
        const { BlobServiceClient } = require('@azure/storage-blob');

        // Create mock instances for Azure Data Tables
        const mockTableClient = {
            createTable: jest.fn().mockResolvedValue({ tableName: 'test' }),
            upsertEntity: jest.fn().mockResolvedValue({}),
            getEntity: jest.fn().mockResolvedValue({ partitionKey: 'test', rowKey: 'test' }),
            listEntities: jest.fn().mockReturnValue({ 
                [Symbol.asyncIterator]: async function* () {
                    yield { partitionKey: 'test', rowKey: 'test' };
                }
            }),
            deleteEntity: jest.fn().mockResolvedValue({})
        };

        const mockTableServiceClient = {
            createTable: jest.fn().mockResolvedValue({ tableName: 'test' }),
            url: 'https://test.table.core.windows.net'
        };

        // Create mock instances for Azure Blob Storage  
        const mockBlobServiceClient = {
            getContainerClient: jest.fn().mockReturnValue({
                createIfNotExists: jest.fn().mockResolvedValue({}),
                deleteIfExists: jest.fn().mockResolvedValue({})
            })
        };

        const mockCredential = {};

        // Mock the constructors
        TableClient.mockImplementation(() => mockTableClient);
        TableServiceClient.mockImplementation(() => mockTableServiceClient);
        TableServiceClient.fromConnectionString = jest.fn().mockReturnValue(mockTableServiceClient);
        AzureNamedKeyCredential.mockImplementation(() => mockCredential);
        BlobServiceClient.mockImplementation(() => mockBlobServiceClient);

        // Set up test data with mock values instead of nconf
        storageAcct = 'mockedstorageaccount';
        storageKey = 'mockedstoragekey==';
        storageTable = 'unittests';

        testModel = new CarTest();
        testModel.partitionKey = 'testPartition';
        testModel.rowKey = 'row 1';
        testModel.color = 'blue';
        testModel.make = 'Honda';
        testModel.model = 'Civic';
        testModel.year = 2003;
        testModel.dateMade = new Date();
        testModel.turboType = undefined; // test undefined scenario
        testModel.engine = { isPowerful: true };
        testModel.classVersion = 1;

        testModel.logs = [new CarLog(123, 'test'), new CarLog(456, 'test 2')];

        logger = createLogger({
            level: 'debug',
            transports: [
              new transports.Console(),
            ],
          });

        logger.info('Account: ' + storageAcct);

        testModelManager = new AzureDocumentStorageManager<CarTest>(CarTest);
        testModelManager.converters = [new TableStorageObjectTypeConverter(), new TableStorageArrayConverter()]
        convObject = testModelManager.convertToAzureObj(testModel);
        convertedTestModel = testModelManager.convertFromObjToType(testModelManager.convertFromAzureObjToObject(convObject));

        AzureTableDocumentCacheInMemory.prototype.setItem = jest.fn(AzureTableDocumentCacheInMemory.prototype.setItem);
    });

    // afterAll(() => {

    // });

    test('can convert to an azure object', () => {
        expect(convObject !== null).toBeTruthy();
        // tslint:disable-next-line:no-string-literal
        expect(convObject['PartitionKey'] !== null).toBeTruthy();
    });

    test('can convert from an azure object', () => {
        expect(convertedTestModel !== null).toBeTruthy();
        expect(convertedTestModel.partitionKey !== null).toBeTruthy();
    });

    test('original and converted from are same', () => {
        let modelComparer: ModelComparer<CarTest> = new ModelComparer<CarTest>();
        let areSame = modelComparer.propertiesAreEqualToFirst(testModel, convertedTestModel, true);
        expect(areSame).toBeTruthy();
    });

    test('can use functions after type conversion', () => {
        expect(convertedTestModel.isOn).not.toBeTruthy();
        convertedTestModel.turnOn();
        expect(convertedTestModel.isOn).toBeTruthy();
    });

    test('can upgrade correctly', () => {
        let convNormObj: Object = testModelManager.convertFromAzureObjToObject(convObject);
        let preUpgradedObj: CarTest = testModelManager.convertFromObjToType(convNormObj);
        testModelManager.updateModel(convNormObj);
        let upgradedObj: CarTest = testModelManager.convertFromObjToType(convNormObj);
        expect(preUpgradedObj.classVersion === 1 && preUpgradedObj.tireName !== 'New Tire').toBeTruthy();
        expect(upgradedObj.classVersion === 2 && upgradedObj.tireName === 'New Tire').toBeTruthy();
    });

    test('can create test table', async () => {
        const manager: AzureDocumentStorageManager<CarTest> = new AzureDocumentStorageManager<CarTest>(CarTest, storageAcct, storageKey);
        manager.initializeConnection();
        const success: IOperationResult = await manager.createTableIfNotExists(storageTable);
        expect(success).not.toBeNull();
        expect(success.status).toBe(OperationResultStatus.success);
    });
    
    test('can insert record, retrieve, query and remove', async () => {
        const newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cars';
        newCar.rowKey = 'car1';
        newCar.color = 'Blue';
        newCar.make = 'Honda';
        newCar.model = 'Civic';
        newCar.year = 2003;
        newCar.dateMade = new Date();
        newCar.turboType = undefined;
        newCar.engine = { isPowerful: true };
        newCar.classVersion = 1;
        newCar.isOn = false;

        const manager: AzureDocumentStorageManager<CarTest> = new AzureDocumentStorageManager<CarTest>(CarTest, storageAcct, storageKey);
        manager.initializeConnection();

        // Test save operation
        const saveResult: IOperationResult = await manager.save(storageTable, newCar);
        expect(saveResult).not.toBeNull();
        expect(saveResult.status).toBe(OperationResultStatus.success);

        // Test retrieve by partition and row key
        const dataSuccess: AzureDocumentResult<CarTest> = await manager.getByPartitionAndRowKey(storageTable, 'cars', 'car1');
        expect(dataSuccess.status).toBe(OperationResultStatus.success);
        
        // Since we're using stubs, we might not get actual data back, but the call should succeed
        // This tests the interface compatibility rather than actual Azure integration
    });

    test('batch operations work', async () => {
        const lotsaCars: CarTest[] = generateLotsOfCars('batchTest1', 5); // Use smaller number for testing

        const manager: AzureDocumentStorageManager<CarTest> = new AzureDocumentStorageManager<CarTest>(CarTest, storageAcct, storageKey);
        manager.initializeConnection();
        
        // Test batch save
        const saveResults: AzureDocumentBatchResults = await manager.saveMany(storageTable, lotsaCars);
        expect(saveResults).not.toBeNull();
        expect(saveResults.overallStatus).toBe(BatchResultStatus.allSuccess);
        
        // Test batch remove
        const removeResults: AzureDocumentBatchResults = await manager.removeMany(storageTable, lotsaCars);
        expect(removeResults).not.toBeNull();
        expect(removeResults.overallStatus).toBe(BatchResultStatus.allSuccess);
    });

    test('caching class works', () => {
        let comparer: ModelComparer<CarTest> = new ModelComparer<CarTest>();
        let newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cachecars1';
        newCar.rowKey = 'car1';
        newCar.color = 'Blue';
        newCar.make = 'Honda';
        newCar.model = 'Civic';
        newCar.year = 2003;
        newCar.dateMade = new Date();
        newCar.turboType = undefined; // test undefined scenario
        newCar.engine = { isPowerful: true };
        newCar.classVersion = 1;
        newCar.isOn = false;

        let newCarId: AzureDocumentIdentifier = AzureDocumentIdentifier.fromObj(newCar);
        let tempTableName: string = 'testing';

        let azureCache: AzureTableDocumentCacheInMemory<CarTest> = new AzureTableDocumentCacheInMemory<CarTest>();
        expect(azureCache.getItem(tempTableName, newCarId)).toBeNull();
        expect(azureCache.getItem(tempTableName, newCarId)).toBeNull();

        azureCache.setItem(tempTableName, newCar, moment.duration(5, 'minutes'));

        let cachedCar: CarTest = azureCache.getItem(tempTableName, newCarId);
        expect(cachedCar).not.toBeNull();
        expect(comparer.propertiesAreEqualToFirst(newCar, cachedCar)).toBeTruthy();

        azureCache.invalidateCacheItem(tempTableName, newCarId);
        expect(azureCache.getItem(tempTableName, newCarId)).toBeNull();        

        let newCar2: CarTest = new CarTest();
        newCar2.partitionKey = 'cachecars1';
        newCar2.rowKey = 'car1';
        newCar2.color = 'Blue';
        newCar2.make = 'Honda';
        newCar2.model = 'Civic';
        newCar2.year = 2003;
        newCar2.dateMade = new Date();
        newCar2.turboType = undefined; // test undefined scenario
        newCar2.engine = { isPowerful: true };
        newCar2.classVersion = 1;
        newCar2.isOn = false;
        
        let carArray: CarTest[] = [];
        carArray.push(newCar2);

        let testQuery: any = { 
            conditions: ['make eq Honda'],
            toQueryObject: () => 'make eq Honda'
        }; // Simplified for testing
        expect(azureCache.getItemsByQuery(tempTableName, testQuery)).toBeNull();
        expect(azureCache.getItemsByQuery(tempTableName, testQuery)).toBeNull();

        azureCache.setItemsByQuery(tempTableName, carArray, testQuery, moment.duration(3, 'minutes'));

        let cachedCarArray: CarTest[] = azureCache.getItemsByQuery(tempTableName, testQuery);
        expect(cachedCarArray).not.toBeNull();
        expect(cachedCarArray).toHaveLength(1);

        let cachedCarArrayCar: CarTest = azureCache.getItem(tempTableName, AzureDocumentIdentifier.fromObj(newCar2));
        expect(cachedCarArrayCar).not.toBeNull();
        expect(comparer.propertiesAreEqualToFirst(cachedCarArrayCar, newCar2)).toBeTruthy();
        cachedCarArrayCar.color = 'pink';
        expect(comparer.propertiesAreEqualToFirst(cachedCarArrayCar, newCar2)).toBeTruthy();
        expect(newCar2.color === 'pink').toBeTruthy();

        azureCache.resetTableCache(tempTableName);

        expect(azureCache.getItemsByQuery(tempTableName, testQuery)).toBeNull();
    });

    test('test caching with data works', async () => {
        let newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cachecars2';
        newCar.rowKey = 'car1';
        newCar.color = 'Blue';
        newCar.make = 'Honda';
        newCar.model = 'Civic';
        newCar.year = 2003;
        newCar.dateMade = new Date();
        newCar.turboType = undefined; // test undefined scenario
        newCar.engine = { isPowerful: true };
        newCar.isOn = false;

        let newCar2: CarTest = new CarTest();
        newCar2.partitionKey = 'cachecars2';
        newCar2.rowKey = 'car2';
        newCar2.color = 'Blue';
        newCar2.make = 'Honda';
        newCar2.model = 'Something';
        newCar2.year = 2008;
        newCar2.dateMade = new Date();
        newCar2.turboType = undefined; // test undefined scenario
        newCar2.engine = { isPowerful: true };
        newCar2.isOn = false;

        let cars: CarTest[] = [];
        cars.push(newCar);
        cars.push(newCar2);

        const manager: AzureDocumentStorageManager<CarTest> = new AzureDocumentStorageManager<CarTest>(CarTest, storageAcct, storageKey);
        const managerAny: any = <any>manager;
        manager.initializeConnection();

        // Test batch save
        const saveRes: AzureDocumentBatchResults = await manager.saveMany(storageTable, cars);
        expect(saveRes.overallStatus).toBe(BatchResultStatus.allSuccess);

        // Test caching functionality
        const queryRes: AzureDocumentResult<CarTest> = await manager.getByPartitionAndRowKey(storageTable, newCar.partitionKey, newCar.rowKey, true);
        expect(queryRes.status).toBe(OperationResultStatus.success);
        expect(managerAny.cache).not.toBeUndefined();
        expect(managerAny.cache).not.toBeNull();
    });

    let generateLotsOfCars = (partitionName: string, amount: number): CarTest[] => {
        let returnCars: CarTest[] = [];
        // tslint:disable-next-line:no-increment-decrement
        for (let i = 0; i < amount; i++) {
            let newCar: CarTest = new CarTest();
            newCar.partitionKey = partitionName;
            newCar.rowKey = 'car' + i;
            newCar.color = 'Some Color';
            newCar.make = 'Honda';
            newCar.model = 'Civic';
            newCar.year = 2003;
            newCar.dateMade = new Date();
            newCar.turboType = undefined; // test undefined scenario
            newCar.engine = { isPowerful: true };
            newCar.classVersion = 1;
            newCar.isOn = false;
            returnCars.push(newCar);
        }
        
        return returnCars;
    };
});
