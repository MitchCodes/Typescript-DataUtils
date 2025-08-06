import { ThrottledMemoryQueuePubSubManager } from '../src/data/pubsub/throttled-memory-queue-pubsub-manager';
import { ClassFunctionDistributorCreator, RoundRobinClassFunctionDistributorAlgorithm } from '../src/logic/class-function-distributor';
import { ClassFunctionThrottler } from '../src/logic/class-function-throttler';
import { ModelComparer } from '../src/logic/helpers/modelcompare.helper';
import { DateJsonPropertyHandler } from '../src/logic/json-serialization/date-property-handler';
import { JsonSerializer } from '../src/logic/json-serialization/json-serializer';
import { UndefinedJsonPropertyHandler } from '../src/logic/json-serialization/undefined-property-handler';
import { QueuedCommandRunner } from '../src/logic/queued-command-runner';
import { ClassFunctionRetrier, IClassFunctionDistributor } from '../src/main';
import { PubSubReceiveMessageResult } from '../src/models/pub-sub-message';
import { QueuedCommandJob } from '../src/models/queued-command';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


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

export class CarService {
  public someField: string = 'lol';
  public timesFailed: number = 0;
  public timesFailedAsync: number = 0;
  
  public async getCar(tireName: string, model: string, uselessInput: number): Promise<CarTest> {
    const carTest: CarTest = new CarTest();
    carTest.tireName = tireName;
    carTest.model = model;
    return carTest;
  }

  public async setCar(car: CarTest): Promise<void> {
    return;
  }

  public getCarTireName(car: CarTest): string {
    return car.tireName;
  }

  public getSomeField(): string {
    return this.someField;
  }

  public getSomeFieldWithFailNumber(): string {
    if (this.timesFailed < 2) {
      this.timesFailed = this.timesFailed + 1;
      throw new Error('blah some crappy error');
    }

    return this.someField;
  }

  public async getSomeFieldWithFailNumberAsync(): Promise<string> {
    if (this.timesFailedAsync < 2) {
      this.timesFailedAsync = this.timesFailedAsync + 1;
      throw new Error('blah some crappy error');
    }

    return this.someField;
  }

  public getSomeFieldAlwaysFails(): string {
    throw new Error('this code sucks');
  }

  public async getSomeFieldAlwaysFailsAsync(): Promise<string> {
    throw new Error('this code sucks');
  }
}

describe('basic test', () => {
  // Read more about fake timers: http://facebook.github.io/jest/docs/en/timer-mocks.html#content
  //jest.useFakeTimers();

  // Act before assertions
  beforeAll(async () => {
  });

  // tslint:disable-next-line:mocha-unneeded-done
  test('expect true to be true', (done: any) => {
    expect(true).toBeTruthy();
    
    done();
  });

});

describe('json serializer tests', () => {
  let testModel: CarTest;
  let carCompareHelper: ModelComparer<CarTest>;

  beforeAll(() => {
    carCompareHelper = new ModelComparer<CarTest>();

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
  });

  test('expect json serializer to work', () => {
    const serialized: string = JSON.stringify(testModel);
    console.debug('Serialized car using json stringify: ' + serialized);

    const parsed: CarTest = JSON.parse(serialized);

    expect(carCompareHelper.propertiesAreEqualToFirst(testModel, parsed)).not.toBeTruthy();

    let jsonSerializer: JsonSerializer = new JsonSerializer([new DateJsonPropertyHandler()]);
    const serializedTwo: string = jsonSerializer.stringify(testModel);
    console.debug('Serialized car using json serializer w/ just date helper: ' + serializedTwo);
    const parsedTwo: CarTest = jsonSerializer.parse(serializedTwo);

    expect(carCompareHelper.propertiesAreEqualToFirst(testModel, parsedTwo)).toBeTruthy();

    jsonSerializer = new JsonSerializer([new DateJsonPropertyHandler(), new UndefinedJsonPropertyHandler()]);
    const serializedThree: string = jsonSerializer.stringify(testModel);
    console.debug('Serialized car using json serializer: ' + serializedThree);
    const parsedThree: CarTest = jsonSerializer.parse(serializedThree);

    expect(carCompareHelper.propertiesAreEqualToFirst(testModel, parsedThree)).toBeTruthy();
  });

  test('expect retry logic to work', async () => {
    const carServiceOne: CarService = new CarService();
    carServiceOne.someField = 'one';

    const classFunctionRetrier: ClassFunctionRetrier = new ClassFunctionRetrier();
    const retriedCarService: CarService = classFunctionRetrier.getRetryableClass<CarService>(carServiceOne, 3);
    const retriedCarServiceAsync: CarService = classFunctionRetrier.getRetryableClassAsync<CarService>(carServiceOne, 3);

    const someFieldOne: string = retriedCarService.getSomeFieldWithFailNumber();
    const someFieldTwo: string = await retriedCarServiceAsync.getSomeFieldWithFailNumberAsync();

    expect(someFieldOne === 'one').toBeTruthy();
    expect(someFieldTwo === 'one').toBeTruthy();

    expect(carServiceOne.timesFailed === 2).toBeTruthy();
    expect(carServiceOne.timesFailedAsync === 2).toBeTruthy();

    let errorHappened: boolean = false;
    try {
      retriedCarService.getSomeFieldAlwaysFails();
    } catch (err) {
      errorHappened = true;
    }

    let errorHappenedAsync: boolean = false;
    try {
      await retriedCarService.getSomeFieldAlwaysFailsAsync();
    } catch (err) {
      errorHappenedAsync = true;
    }

    expect(errorHappened).toBeTruthy();
    expect(errorHappenedAsync).toBeTruthy();

    const retriedCarServiceWithBlahReturn: CarService = classFunctionRetrier.getRetryableClass<CarService>(carServiceOne, 3, (error: any, functionName: string): any => {
      return 'blah';
    });

    const retriedCarServiceWithBlahReturnAsync: CarService = classFunctionRetrier.getRetryableClassAsync<CarService>(carServiceOne, 3, (error: any, functionName: string): any => {
      return 'blah';
    });

    const someFieldOneBlah: string = retriedCarServiceWithBlahReturn.getSomeFieldAlwaysFails();
    const someFieldTwoBlah: string = await retriedCarServiceWithBlahReturnAsync.getSomeFieldAlwaysFailsAsync();

    expect(someFieldOneBlah === 'blah').toBeTruthy();
    expect(someFieldTwoBlah === 'blah').toBeTruthy();
  });

  test('expect round robin to work', async () => {
    const carServiceOne: CarService = new CarService();
    carServiceOne.someField = 'one';

    const carServiceTwo: CarService = new CarService();
    carServiceTwo.someField = 'two';

    const carServiceThree: CarService = new CarService();
    carServiceThree.someField = 'three';

    const roundRobinDistributor: ClassFunctionDistributorCreator = new ClassFunctionDistributorCreator();
    const distributedCarService: CarService & IClassFunctionDistributor<CarService> = roundRobinDistributor.getDistributedObject<CarService>([carServiceOne, carServiceTwo, carServiceThree], new RoundRobinClassFunctionDistributorAlgorithm());
    
    const someFieldOne: string = distributedCarService.getSomeField();
    const someFieldTwo: string = distributedCarService.getSomeField();
    const someFieldThree: string = distributedCarService.getSomeField();
    const someFieldFour: string = distributedCarService.getSomeField();

    expect(someFieldOne === 'one').toBeTruthy();
    expect(someFieldTwo === 'two').toBeTruthy();
    expect(someFieldThree === 'three').toBeTruthy();
    expect(someFieldFour === 'one').toBeTruthy();
  });
  
  test('expect queued command runner to work', async () => {
    const queuedCommandRunner: QueuedCommandRunner = new QueuedCommandRunner();

    let jobStarted: boolean = false;
    let jobFinished: boolean = false;
    let errorHappened: boolean = false;

    const beginning: number = Date.now();
    const lastExecuted: number = Date.now();

    let jobsFinished: number = 0;

    queuedCommandRunner.on('error', (err: Error) => {
      console.debug('Queued command runner error: ' + err);
      errorHappened = true;
    });

    queuedCommandRunner.on('startJob', (job: QueuedCommandJob) => {
      console.debug('Job started at ' + (Date.now() - beginning) + 'ms');
      jobStarted = true;
    });

    queuedCommandRunner.on('finishJob', (job: QueuedCommandJob) => {
      console.debug('Job finished at ' + (Date.now() - beginning) + 'ms');
      jobsFinished++;
      jobFinished = true;
    });

    queuedCommandRunner.addJob(new QueuedCommandJob('test', async () => {
      await sleep(3000);
    }));

    for (let i = 0; i < 10; i++) {
      queuedCommandRunner.addJob(new QueuedCommandJob('test', async () => {
        await sleep(1500);
      }, 'test', 4));
    }

    queuedCommandRunner.addJob(new QueuedCommandJob('test', async () => {
      await sleep(3000);
    }))

    queuedCommandRunner.addJob(new QueuedCommandJob('test', async () => {
      await sleep(3000);
      throw new Error('test error');
    }))

    for (let i = 0; i < 2; i++) {
      queuedCommandRunner.addJob(new QueuedCommandJob('test', async () => {
        await sleep(1500);
      }, 'test', 4));
    }

    for (let i = 0; i < 2; i++) {
      queuedCommandRunner.addJob(new QueuedCommandJob('test', async () => {
        await sleep(1500);
      }, 'test2', 4));
    }

    for (let i = 0; i < 2; i++) {
      queuedCommandRunner.addJob(new QueuedCommandJob('test', async () => {
        await sleep(1500);
      }, 'test', 4));
    }

    for (let i = 0; i < 2; i++) {
      queuedCommandRunner.addJob(new QueuedCommandJob('test', async () => {
        await sleep(1500);
      }, 'test2', 4));
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(jobStarted).toBeTruthy();
        expect(jobFinished).toBeTruthy();
        expect(errorHappened).toBeTruthy();
        expect(jobsFinished === 20).toBeTruthy();
        resolve();
      }, 25000);
    });
  }, 45000);

  test('test class throttler', async () => {
    const classFunctionThrottler: ClassFunctionThrottler = new ClassFunctionThrottler();

    const carService: CarService = new CarService();
    const carServiceThrottled: CarService = classFunctionThrottler.getThrottledClass<CarService>(carService, 2, 1000);

    expect(carServiceThrottled).not.toBeNull();

    const beginning: number = Date.now();
    let lastExecuted: number = Date.now();

    let timesExecuted: number = 0;

    for (let i = 0; i < 15; i++) {
      carServiceThrottled.getCar('some tire', 'Civic', 3).then((car: CarTest) => {
        //console.debug('Car ' + timesExecuted + ' received, tire: ' + car.tireName);
        timesExecuted++;
        lastExecuted = Date.now();
      });
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(timesExecuted === 15).toBeTruthy();

        const timeElapsed: number = lastExecuted - beginning;
        expect(timeElapsed > 5000).toBeTruthy();
        resolve();
      }, 15000);
    });
  }, 30000);

  test('expect throttled pubsub to work', async () => {
    const throttledQueue: ThrottledMemoryQueuePubSubManager = new ThrottledMemoryQueuePubSubManager(2, 1000);
    await throttledQueue.initializeConnection();

    const beginning: number = Date.now();
    let lastExecuted: number = Date.now();

    let timesExecuted: number = 0;

    throttledQueue.subscribe<string>('test', ((message: string): PubSubReceiveMessageResult => {
      const result: PubSubReceiveMessageResult = new PubSubReceiveMessageResult();
      result.messageHandled = true;

      timesExecuted++;
      lastExecuted = Date.now();

      return result;
    }), ((error: Error) => {
        throw error;
    }));

    let index: number = 0;
    for (let i = 0; i < 15; i++) {
      await throttledQueue.publish<string>((++index).toString());
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(timesExecuted === 15).toBeTruthy();

        const timeElapsed: number = lastExecuted - beginning;
        expect(timeElapsed > 5000).toBeTruthy();
        resolve();
      }, 15000);
    });
  }, 30000);

});
