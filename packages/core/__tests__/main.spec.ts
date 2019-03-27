import { ModelComparer, JsonSerializer, DateJsonPropertyHandler, UndefinedJsonPropertyHandler } from '../src/main';

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

describe('basic test', () => {
  // Read more about fake timers: http://facebook.github.io/jest/docs/en/timer-mocks.html#content
  jest.useFakeTimers();

  // Act before assertions
  beforeAll(async () => {
    jest.runOnlyPendingTimers();
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
    let serialized: string = JSON.stringify(testModel);
    console.debug('Serialized car using json stringify: ' + serialized);

    let parsed: CarTest = JSON.parse(serialized);

    expect(carCompareHelper.propertiesAreEqualToFirst(testModel, parsed)).not.toBeTruthy();

    let jsonSerializer: JsonSerializer = new JsonSerializer([new DateJsonPropertyHandler()]);
    let serializedTwo: string = jsonSerializer.stringify(testModel);
    console.debug('Serialized car using json serializer w/ just date helper: ' + serializedTwo);
    let parsedTwo: CarTest = jsonSerializer.parse(serializedTwo);

    expect(carCompareHelper.propertiesAreEqualToFirst(testModel, parsedTwo)).toBeTruthy();

    jsonSerializer = new JsonSerializer([new DateJsonPropertyHandler(), new UndefinedJsonPropertyHandler()]);
    let serializedThree: string = jsonSerializer.stringify(testModel);
    console.debug('Serialized car using json serializer: ' + serializedThree);
    let parsedThree: CarTest = jsonSerializer.parse(serializedThree);

    expect(carCompareHelper.propertiesAreEqualToFirst(testModel, parsedThree)).toBeTruthy();
  });

});
