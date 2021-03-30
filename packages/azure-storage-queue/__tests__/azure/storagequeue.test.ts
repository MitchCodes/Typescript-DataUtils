// tslint:disable:no-console no-require-imports no-var-requires

import { Logger, createLogger, transports } from 'winston';
import * as nconf from 'nconf';
import { ModelComparer, IOperationResult, OperationResultStatus, BatchResultStatus, QueueMessageResult, QueueMessageOptions } from 'tsdatautils-core';
import * as moment from 'moment';
import { AzureQueueStorageManager } from '../../src/data/azure-queue-storage-manager';
import { QueueMessageConverter } from '../../src/converter/queue-message-converter';

export class CarTest {
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

describe('azure-queue-manager-tests', () => {
    let logger: Logger;
    let testModel: CarTest;
    let convObject: Object = null;
    let convertedTestModel: CarTest;
    let testQueueStorageManager: AzureQueueStorageManager;

    let storageAcct: string;
    let storageKey: string;
    let storageQueue: string;

    beforeAll(() => {
        nconf.defaults({
            testAccount: '',
            testAccountKey: '',
            testQueue: 'unittests',
        });
        nconf.file({ file: './config.common.json' });
        

        storageAcct = nconf.get('testAccount');
        storageKey = nconf.get('testAccountKey');
        storageQueue = nconf.get('testQueue');

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

        logger = createLogger({
            level: 'debug',
            transports: [
              new transports.Console(),
            ],
          });

        logger.info('Account: ' + storageAcct);

        testQueueStorageManager = new AzureQueueStorageManager(storageAcct, storageKey);
        testQueueStorageManager.initializeConnection();
    });

    // afterAll(() => {

    // });

    test('can convert model to messsage', async (done: any) => {
        let newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cars';
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

        let modelComparer: ModelComparer<CarTest> = new ModelComparer();

        let queueMessageConverter: QueueMessageConverter = new QueueMessageConverter();

        let messageOptions: QueueMessageOptions = new QueueMessageOptions();
        messageOptions.convertToBase64 = true;
        messageOptions.gzipCompress = true;


        let message: any = await queueMessageConverter.convertToMessage<CarTest>(newCar, messageOptions);
        let backToCar: any = await queueMessageConverter.convertFromMessage<CarTest>(message);
        expect(modelComparer.propertiesAreEqualToFirst(newCar, backToCar));

        messageOptions.convertToBase64 = false;
        messageOptions.gzipCompress = true;

        message = await queueMessageConverter.convertToMessage<CarTest>(newCar, messageOptions);
        backToCar = await queueMessageConverter.convertFromMessage<CarTest>(message);
        expect(modelComparer.propertiesAreEqualToFirst(newCar, backToCar));

        messageOptions.convertToBase64 = true;
        messageOptions.gzipCompress = false;

        message = await queueMessageConverter.convertToMessage<CarTest>(newCar, messageOptions);
        backToCar = await queueMessageConverter.convertFromMessage<CarTest>(message);
        expect(modelComparer.propertiesAreEqualToFirst(newCar, backToCar));

        messageOptions.convertToBase64 = false;
        messageOptions.gzipCompress = false;

        message = await queueMessageConverter.convertToMessage<CarTest>(newCar, messageOptions);
        backToCar = await queueMessageConverter.convertFromMessage<CarTest>(message);
        expect(modelComparer.propertiesAreEqualToFirst(newCar, backToCar));

        done();
    });

    test('can create test queue', (done: any) => {
        testQueueStorageManager.createQueueIfNotExists(storageQueue).then((success: IOperationResult) => {
            expect(success !== null).toBeTruthy();
            done();
        }).catch((err: IOperationResult) => {
            expect(false).toBeTruthy();
            done();
        });
    });
    
    test('can queue record, get record and delete', async (done: any) => {
        let newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cars';
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

        let queueAddOptions: QueueMessageOptions = new QueueMessageOptions();
        queueAddOptions.convertToBase64 = true;
        queueAddOptions.gzipCompress = true;

        let result: IOperationResult = await testQueueStorageManager.addMessage<CarTest>(storageQueue, newCar, queueAddOptions);
        expect(result.status === OperationResultStatus.success).toBeTruthy();

        let queueMessageResult: QueueMessageResult<CarTest> = await testQueueStorageManager.getNextMessage<CarTest>(storageQueue);

        expect(queueMessageResult.status === OperationResultStatus.success).toBeTruthy();

        let carTest: CarTest = queueMessageResult.data;
        let messageId: string = queueMessageResult.messageId;

        let deleteMessageResult: IOperationResult = await testQueueStorageManager.deleteMessage(storageQueue, queueMessageResult.messageId);

        expect(deleteMessageResult.status === OperationResultStatus.success).toBeTruthy();

        done();
    });
});
