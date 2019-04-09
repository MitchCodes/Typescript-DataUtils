// tslint:disable:no-console no-require-imports no-var-requires
import { AzureBlobStorageManager, AzureBlobOperationResult } from '../../src/data/azure-blob-storagemanager.logic';
import * as winston from 'winston';
import * as nconf from 'nconf';
import { ModelComparer, IOperationResult, OperationResultStatus, BatchResultStatus, IOperationResultWithData, BlobInfo, Dictionary } from 'tsdatautils-core';
import { TableQuery } from 'azure-storage';
import * as moment from 'moment';
import { Writable, Stream } from 'stream';
import { fstat, readFile, createReadStream, ReadStream, existsSync, mkdirSync, rmdirSync } from 'fs';
jest.mock('../../src/data/azure-blob-storagemanager.logic');

class BasicStream extends Stream.Writable {
    public totalBytes: number = 0;
    public endCallback: Function = null;

    public constructor(endCallback: Function = null) {
        super();
        this.endCallback = endCallback;
    }

    public write(chunk: any, enc: any, next: Function = null): boolean {
        this.totalBytes += chunk.length;
        //console.debug(chunk);
        if (next !== null) {
            next();
        }

        return true;
    }

    public end(cb: Function = null): void {
        if (this.endCallback !== null) {
            this.endCallback();
        }

        super.end(cb); // this took me hours to finally realize this needed to happen
    }
}

describe('azure-storage-manager-tests', () => {
    let logger: winston.LoggerInstance;
    let convObject: Object = null;
    let blobManager: AzureBlobStorageManager;

    let storageAcct: string;
    let storageKey: string;
    let storageContainer: string;

    beforeAll(() => {
        nconf.file({ file: './config.common.json' });
        nconf.defaults({
            test: {
                azure: {
                    testAccount: '',
                    testAccountKey: '',
                    testTable: 'unittests',
                    testBlobContainer: 'testcontainer',
                },
            },
        });

        storageAcct = nconf.get('test:azure:testAccount');
        storageKey = nconf.get('test:azure:testAccountKey');
        storageContainer = nconf.get('test:azure:testBlobContainer');

        logger = new winston.Logger({
            level: 'debug',
            transports: [
              new (winston.transports.Console)(),
            ],
          });

        logger.info('Blob Account: ' + storageAcct);

        blobManager = new AzureBlobStorageManager(storageAcct, storageKey);
        blobManager.initializeConnection();
    });

    test('blob manager is not null', () => {
        expect(blobManager !== null).toBeTruthy();
    });

    test('can create container', (done: any) => {
        blobManager.createContainerIfNotExists(storageContainer).then((res: IOperationResult) => {
            done();
        });
    });

    test('can create blob from file', (done: any) => {
        blobManager.createBlobFromFile(storageContainer, 'levelup.mp3', './__tests__/levelup.mp3').then((res: IOperationResult) => {
            done();
        });
    });

    test('can create blob from stream', (done: any) => {
        blobManager.createBlobWritingStream(storageContainer, 'levelup_stream.mp3').then((res: IOperationResultWithData<Writable>) => {
            expect(res.data).not.toBeUndefined();
            expect(res.data).not.toBeNull();

            let mp3Stream: ReadStream = createReadStream('./__tests__/levelup.mp3');
            res.data.on('close', () => {
                console.debug('Bytes read from file: ' + mp3Stream.bytesRead);
                done();
            });

            mp3Stream.pipe(res.data);
        });
    });

    test('can get blob to stream', (done: any) => {
        blobManager.createBlobFromFile(storageContainer, 'levelup2.mp3', './__tests__/levelup.mp3').then((res: IOperationResult) => {            
            let getBlobStream: BasicStream = new BasicStream(() => {
                console.debug('Total stream bytes: ' + getBlobStream.totalBytes);
            });
    
            blobManager.getBlobToStream(storageContainer, 'levelup2.mp3', getBlobStream).then((getRes: IOperationResultWithData<BlobInfo>) => {
                console.info('Blob stream content length: ' + getRes.data.contentLength);
                console.info('Blob stream content encoding: ' + getRes.data.contentEncoding);
                setTimeout(() => {
                    expect(getBlobStream.totalBytes > 0).toBeTruthy();
                    expect(Number(getRes.data.contentLength) > 0).toBeTruthy();
                    expect(getRes.data.contentType).not.toBeUndefined();
                    expect(getRes.data.contentType).not.toBeNull();
                    done();
                // tslint:disable-next-line:align
                }, 250);
            });
        });        
    });

    test('can get blob to file', (done: any) => {
        if (!existsSync('./tmp')) {
            mkdirSync('./tmp');
        }

        if (!existsSync('./tmp/jest')) {
            mkdirSync('./tmp/jest');
        }

        let saveAs: string = './tmp/jest/levelup3.mp3';

        blobManager.createBlobFromFile(storageContainer, 'levelup3.mp3', './__tests__/levelup.mp3').then((res: IOperationResult) => {
            blobManager.getBlobToFile(storageContainer, 'levelup3.mp3', saveAs).then((getRes: IOperationResult) => {
                expect(existsSync(saveAs)).toBeTruthy();
                done();
            });
        });
    });

    test('can remove blob', (done: any) => {
        blobManager.createBlobFromFile(storageContainer, 'levelup4.mp3', './__tests__/levelup.mp3').then((res: IOperationResult) => {
            blobManager.deleteBlobIfExists(storageContainer, 'levelup4.mp3').then((resDel: IOperationResult) => {
                let getBlobStream: BasicStream = new BasicStream(() => {
                    // do nothing
                });
        
                blobManager.getBlobToStream(storageContainer, 'levelup4.mp3', getBlobStream).catch((err: any) => {
                    console.log('Got error successfully: ' + err);
                    done();
                });
            });
        });
    });

    test('can query/get blobs', (done: any) => {
        blobManager.createBlobFromFile(storageContainer, 'levelup5.mp3', './__tests__/levelup.mp3').then((res: IOperationResult) => {
            blobManager.getBlobs(storageContainer).then((getRes: IOperationResultWithData<Dictionary<BlobInfo>>) => {
                expect(getRes).not.toBeUndefined();
                expect(getRes).not.toBeNull();
                expect(getRes.data).not.toBeUndefined();
                expect(getRes.data).not.toBeNull();

                expect(Object.keys(getRes.data).length > 0).toBeTruthy();

                expect(getRes.data['levelup5.mp3']).not.toBeUndefined();
                expect(getRes.data['levelup5.mp3']).not.toBeNull();

                done();
            });
        });
    });

    // azure takes time to delete containers so it makes it difficult to write a test for.
});
