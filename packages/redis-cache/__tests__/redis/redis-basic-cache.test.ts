import * as nconf from 'nconf';
import { BasicRedisCache } from '../../src/main';
import { WinstonLogger, ModelComparer } from 'tsdatautils-core';
jest.mock('../../src/data/basic-redis-cache');

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

describe('redis cache tests', () => {
    // Read more about fake timers: http://facebook.github.io/jest/docs/en/timer-mocks.html#content
    //jest.useFakeTimers();

    let testModel: CarTest;
    let redisHost: string;
    let consoleLogger: WinstonLogger;
    let carComparer: ModelComparer<CarTest>;
  
    // Act before assertions
    beforeAll(async () => {
      //jest.runOnlyPendingTimers();

      nconf.file({ file: './config.common.json' });
      nconf.defaults({
            test: {
                redis: {
                    host: '127.0.0.1',
                },
            },
        });

      redisHost = nconf.get('test:redis:host');
      consoleLogger = new WinstonLogger();
      carComparer = new ModelComparer<CarTest>();

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

    // tslint:disable-next-line:mocha-unneeded-done
    test('redis cache can connect and set an item', (done: any) => {
      let basicRedisCache: BasicRedisCache = new BasicRedisCache(consoleLogger, 'main', redisHost);

      // tslint:disable-next-line: no-floating-promises
      basicRedisCache.setItemAsync('test1', testModel).then((success: boolean) => {
        done();
      });
    });

    // tslint:disable-next-line:mocha-unneeded-done
    test('redis cache can retrieve the item', (done: any) => {
      let basicRedisCache: BasicRedisCache = new BasicRedisCache(consoleLogger, 'main2', redisHost);

      let jsonStringBefore = JSON.stringify(testModel);
      consoleLogger.logDebug('Before cached obj: ' + JSON.stringify(<any>testModel));
      // tslint:disable-next-line: no-floating-promises
      basicRedisCache.setItemAsync('test2', testModel).then((success: boolean) => {
        // tslint:disable-next-line: no-floating-promises
        basicRedisCache.getItemAsync<CarTest>('test2').then((val: CarTest) => {
          consoleLogger.logDebug('Cached obj: ' + JSON.stringify(<any>val));
          expect(val).not.toBeUndefined();
          expect(val).not.toBeNull();

          //expect(testModel.make === val.make).toBeTruthy();

          expect(carComparer.propertiesAreEqualToFirst(testModel, val)).toBeTruthy();
          
          done();
        });
      });
    });

    // tslint:disable-next-line:mocha-unneeded-done
    test('redis cache can remove an item', (done: any) => {
      let basicRedisCache: BasicRedisCache = new BasicRedisCache(consoleLogger, 'main3', redisHost);

      // tslint:disable-next-line: no-floating-promises
      basicRedisCache.setItemAsync('test3', testModel).then((success: boolean) => {
        // tslint:disable-next-line: no-floating-promises
        basicRedisCache.getItemAsync<CarTest>('test3').then((val: CarTest) => {
          expect(val).not.toBeUndefined();
          expect(val).not.toBeNull();

          // tslint:disable-next-line: no-floating-promises
          basicRedisCache.removeItemAsync('test3').then(() => {
            // tslint:disable-next-line: no-floating-promises
            basicRedisCache.getItemAsync<CarTest>('test3').then((val2: CarTest) => {
              expect(val2).toBeNull();

              done();
            });
          });
        });
      });
    });

    test('redis cache can clear all', (done: any) => {
      let basicRedisCache: BasicRedisCache = new BasicRedisCache(consoleLogger, 'main4', redisHost);

      // tslint:disable-next-line: no-floating-promises
      basicRedisCache.setItemAsync('test4', testModel).then((success: boolean) => {
        // tslint:disable-next-line: no-floating-promises
        basicRedisCache.getItemAsync<CarTest>('test4').then((val: CarTest) => {
          expect(val).not.toBeUndefined();
          expect(val).not.toBeNull();

          // tslint:disable-next-line: no-floating-promises
          basicRedisCache.clearCacheAsync().then(() => {
            // tslint:disable-next-line: no-floating-promises
            basicRedisCache.getItemAsync<CarTest>('test4').then((val2: CarTest) => {
              expect(val2).toBeNull();

              done();
            });
          });
        });
      });
    });

    afterAll(() => {
      BasicRedisCache.forceCloseAllClients();
    });
  
  });
