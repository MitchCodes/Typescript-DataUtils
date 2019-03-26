import * as winston from 'winston';
import * as moment from 'moment';
import { BasicMemoryCache } from '../../src/data/basic-memory-cache';
import { IBasicCache, IBasicTimedCache, IClearableCache, ModelComparer } from 'tsdatautils-core';
jest.mock('../../src/data/basic-memory-cache');

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

describe('basic memory cache tests', () => {
    // Read more about fake timers: http://facebook.github.io/jest/docs/en/timer-mocks.html#content
    jest.useFakeTimers();

    let logger: winston.LoggerInstance;
    let testModel: CarTest;

    beforeAll(() => {
        jest.runOnlyPendingTimers();

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

        logger = new winston.Logger({
            level: 'debug',
            transports: [
              new (winston.transports.Console)(),
            ],
          });
    });

    test('expect inner cache not to be null', () => {
        let cache: IBasicCache = new BasicMemoryCache();
        let cacheAny: any = <any>cache;
        expect(cacheAny.cache).not.toBeNull();
    });

    test('can set item in cache', () => {
        let cache: IBasicCache = new BasicMemoryCache();
        let cacheAny: any = <any>cache;

        let key: string = 'basic key';
        let bogusKey: string = 'bogus';

        cache.setItem(key, testModel);

        expect(cacheAny.cache).not.toBeUndefined();
        expect(cacheAny.cache).not.toBeNull();
        expect(cacheAny.cache.entityDict).not.toBeUndefined();
        expect(cacheAny.cache.entityDict).not.toBeNull();

        expect(cacheAny.cache.entityDict[key]).not.toBeUndefined();
        expect(cacheAny.cache.entityDict[key]).not.toBeNull();
        expect(cacheAny.cache.entityDict[key].make).toEqual('Honda');

        // Bogus key undefined
        expect(cacheAny.cache.entityDict[bogusKey]).toBeUndefined();
    });

    test('can get item in cache', () => {
        let cache: IBasicCache = new BasicMemoryCache();
        let cacheAny: any = <any>cache;
        let comparer: ModelComparer<CarTest> = new ModelComparer<CarTest>();

        let key: string = 'basic key';
        let bogusKey: string = 'bogus';

        let worked: boolean = cache.setItem(key, testModel);
        expect(worked).toBeTruthy();

        let car: CarTest = cache.getItem<CarTest>(key);

        logger.info('Non-cached model: ' + JSON.stringify(testModel));
        logger.info('Cached model: ' + JSON.stringify(car));

        expect(testModel.make).toEqual(car.make);

        expect(car.make).toEqual('Honda');
        expect(comparer.propertiesAreEqualToFirst(car, testModel)).toBeTruthy();

        let bogusCar: CarTest = cache.getItem<CarTest>(bogusKey);
        expect(bogusCar).toBeNull();
    });

    test('can remove item in cache', () => {
        let cache: IBasicCache = new BasicMemoryCache();
        let cacheAny: any = <any>cache;

        let key: string = 'basic key';
        let bogusKey: string = 'bogus';

        cache.setItem(key, testModel);

        let car: CarTest = cache.getItem<CarTest>(key);

        expect(testModel.make).toEqual('Honda');

        let worked: boolean = cache.removeItem(key);
        expect(worked).toBeTruthy();
        
        expect(cacheAny.cache.entityDict[key]).not.toBeNull();
        expect(cacheAny.cache.entityDict[key]).toBeUndefined();

        let bogusWorked: boolean = cache.removeItem(bogusKey);
        expect(bogusWorked).toBeTruthy();
    });

    test('test clearing cache', () => {
        let cache: IBasicCache & IClearableCache = new BasicMemoryCache();
        let cacheAny: any = <any>cache;

        let key: string = 'basic key';
        let bogusKey: string = 'bogus';

        cache.setItem(key, testModel);

        let car: CarTest = cache.getItem<CarTest>(key);

        expect(testModel.make).toEqual('Honda');

        cache.clearCache();
        
        expect(cacheAny.cache.entityDict[key]).not.toBeNull();
        expect(cacheAny.cache.entityDict[key]).toBeUndefined();
    });

    test('cache cleanup', (done: any) => {
        let cache: IBasicTimedCache = new BasicMemoryCache();
        let cacheAny: any = <any>cache;

        let bogusKey: string = 'bogus';

        let newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cachecarscleanup';
        newCar.rowKey = 'car1';
        newCar.color = 'Blue';
        newCar.make = 'Honda';
        newCar.model = 'Civic';
        newCar.year = 2003;
        newCar.dateMade = new Date();
        newCar.turboType = undefined; // test undefined scenario
        newCar.engine = { isPowerful: true };
        newCar.isOn = false;
        let newCarKey: string = 'basic key';

        let newCar2: CarTest = new CarTest();
        newCar2.partitionKey = 'cachecarscleanup';
        newCar2.rowKey = 'car2';
        newCar2.color = 'Blue';
        newCar2.make = 'Honda';
        newCar2.model = 'Civic';
        newCar2.year = 2003;
        newCar2.dateMade = new Date();
        newCar2.turboType = undefined; // test undefined scenario
        newCar2.engine = { isPowerful: true };
        newCar2.isOn = false;
        let newCarTwoKey: string = 'basic key2';

        cache.setItem(newCarKey, newCar, moment.duration(1, 'days'));
        cache.setItem(newCarTwoKey, newCar2, moment.duration(0));

        expect(cacheAny.cache).not.toBeNull();
        expect(cacheAny.cache.entityDict).not.toBeNull();
        expect(cacheAny.cache.entityDict[newCarKey]).not.toBeUndefined();

        let cachedCar: any = cacheAny.cache.entityDict[newCarKey];
        let cachedCarExpire: any = cacheAny.cache.expireDict[newCarKey];

        let cachedCar2: any = cacheAny.cache.entityDict[newCarTwoKey];
        let cachedCarExpire2: any = cacheAny.cache.expireDict[newCarTwoKey];

        expect(cachedCar).not.toBeUndefined();
        expect(cachedCarExpire).not.toBeUndefined();

        expect(cachedCar2).not.toBeUndefined();
        expect(cachedCarExpire2).not.toBeUndefined();

        cacheAny.cache.expireDict[newCarTwoKey] = moment().subtract(moment.duration(2, 'days'));

        cacheAny.cleanup = jest.fn(cacheAny.cleanup);
        cacheAny.nextCleanup = moment().subtract(moment.duration(1, 'days'));

        cacheAny.cleanupIfTime().then((res: any) => {
            expect(cacheAny.cleanup).toHaveBeenCalled();

            cachedCar = cacheAny.cache.entityDict[newCarTwoKey];
            cachedCarExpire = cacheAny.cache.expireDict[newCarTwoKey];  
            
            expect(cachedCar).toBeUndefined();
            expect(cachedCarExpire).toBeUndefined();

            cachedCar = cacheAny.cache.entityDict[newCarKey];
            cachedCarExpire = cacheAny.cache.expireDict[newCarKey];  

            expect(cachedCar).not.toBeUndefined();
            expect(cachedCarExpire).not.toBeUndefined();

            cacheAny.cache.expireDict[newCarKey] = moment().subtract(moment.duration(2, 'days'));
            cacheAny.nextCleanup = moment().subtract(moment.duration(1, 'days'));

            cacheAny.cleanupIfTime().then((res2: any) => {
                cachedCar = cacheAny.cache.entityDict[newCarKey];
                cachedCarExpire = cacheAny.cache.expireDict[newCarKey];  

                expect(cachedCar).toBeUndefined();
                expect(cachedCarExpire).toBeUndefined();

                done();
            });
        });
    });

});
