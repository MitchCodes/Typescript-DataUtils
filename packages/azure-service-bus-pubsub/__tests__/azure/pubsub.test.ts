// tslint:disable:no-console no-require-imports no-var-requires

import { Logger, createLogger, transports } from 'winston';
import * as nconf from 'nconf';
import { ModelComparer, IOperationResult, OperationResultStatus, BatchResultStatus, QueueMessageResult, QueueMessageOptions, PubSubReceiveMessageResult } from 'tsdatautils-core';
import * as moment from 'moment';
import { AzurePubSubServiceBusQueueManager } from '../../src/data/pubsub-servicebus-queue-manager';
import { PubSubMessageConverter } from '../../src/converter/pubsub-message-converter';

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
}

describe('azure-pubsub-service-bus-manager-tests', () => {
    let logger: Logger;
    let testModel: CarTest;
    let testPubSubManager: AzurePubSubServiceBusQueueManager;

    let serviceBusConnString: string;
    let queueName: string;

    beforeAll(() => {
        nconf.defaults({
            serviceBusConnString: '',
            queueName: 'test',
        });
        nconf.file({ file: './config.common.json' });
        

        serviceBusConnString = nconf.get('serviceBusConnString');
        queueName = nconf.get('queueName');

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

        testPubSubManager = new AzurePubSubServiceBusQueueManager(serviceBusConnString, queueName);
        testPubSubManager.initializeConnection();
    });

    afterAll(async () => {
        await testPubSubManager.closeConnection();
    });

    test('can convert model to message', async (done: any) => {
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

        let converter: PubSubMessageConverter = new PubSubMessageConverter();


        let message: any = await converter.convertToMessage<CarTest>(newCar);
        let backToCar: any = await converter.convertFromMessage<CarTest>(message);
        expect(modelComparer.propertiesAreEqualToFirst(newCar, backToCar));

        done();
    });

    test('can sub and pub and receive', async (done: any) => {
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

        await testPubSubManager.subscribe<CarTest>('test', ((message: CarTest): PubSubReceiveMessageResult => {
            expect(message).toBeTruthy();

            expect(message.color === 'Blue').toBeTruthy();

            let result: PubSubReceiveMessageResult = new PubSubReceiveMessageResult();
            result.status = OperationResultStatus.success;
            result.messageHandled = true;

            return result;
        }), ((err: Error): void => {
            throw err;
        }));

        await testPubSubManager.publish<CarTest>(newCar);

        setTimeout(async () => {
            await testPubSubManager.unsubscribe('test');
            done();
        }, 15000);
    }, 60000);
});
