// tslint:disable:no-console no-require-imports no-var-requires
import { AzureBlobStorageManager, AzureBlobOperationResult } from '../../src/data/azure-blob-storagemanager.logic';
import { Logger, createLogger, transports } from 'winston';
import * as nconf from 'nconf';
import { ModelComparer, IOperationResult, OperationResultStatus, BatchResultStatus, IOperationResultWithData, BlobInfo, Dictionary } from 'tsdatautils-core';
import * as moment from 'moment';
import { Writable, Stream } from 'stream';
import { fstat, readFile, createReadStream, ReadStream, existsSync, mkdirSync, rmdirSync } from 'fs';
import { AzureApplicationInsightsWinstonTransport } from '../../src/data/applicationinsights-winston-transport';
jest.mock('../../src/data/applicationinsights-winston-transport');


describe('applicationinsights-winston-tests', () => {
    let logger: Logger;
    let convObject: Object = null;

    let appInsightInstrumentationKey: string;

    beforeAll(() => {
        nconf.file({ file: './config.common.json' });

        appInsightInstrumentationKey = nconf.get('appInsightInstrumentationKey');

        logger = createLogger({
            level: 'debug',
            transports: [
              new transports.Console(),
              new AzureApplicationInsightsWinstonTransport(true, appInsightInstrumentationKey)
            ],
          });

    });

    test('debug', () => {
      logger.debug('debug');
    });

    test('info', () => {
      logger.info('info');
    });

    test('warn', () => {
      logger.warn('warn');
    });

    test('error', () => {
      logger.error('error');
    });
});
