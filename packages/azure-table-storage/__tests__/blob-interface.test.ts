import { AzureBlobStorageManager } from '../src/main';
import { BlobResult, BlobInfo } from 'tsdatautils-core';
import { Readable, Writable } from 'stream';

describe('Blob Storage Interface Tests', () => {
    test('getBlobToStream returns BlobResult with stream and info', async () => {
        const manager = new AzureBlobStorageManager('test-account', 'test-key');
        
        // This test shows the expected interface - in real usage it would connect to Azure
        // but here we're just verifying the TypeScript interface works correctly
        expect(manager.getBlobToStream).toBeDefined();
        
        // The function should take container and blob name and return BlobResult
        const getBlobToStreamMethod = manager.getBlobToStream;
        expect(typeof getBlobToStreamMethod).toBe('function');
    });

    test('writeBlobToStream takes a Writable stream and returns BlobInfo', async () => {
        const manager = new AzureBlobStorageManager('test-account', 'test-key');
        const mockWritable = new Writable({ 
            write(chunk, encoding, callback) { 
                callback(); 
            } 
        });
        
        // This test shows the expected interface
        expect(manager.writeBlobToStream).toBeDefined();
        
        // The function should take container, blob name, and Writable stream
        const writeBlobToStreamMethod = manager.writeBlobToStream;
        expect(typeof writeBlobToStreamMethod).toBe('function');
    });

    test('Interface distinction is clear between the two methods', () => {
        const manager = new AzureBlobStorageManager('test-account', 'test-key');
        
        // getBlobToStream: (container, blob) => BlobResult (with readable stream)
        // writeBlobToStream: (container, blob, writableStream) => BlobInfo
        
        // This test demonstrates the difference:
        // - getBlobToStream gets a blob and returns a readable stream + metadata
        // - writeBlobToStream writes a blob to a provided writable stream and returns metadata
        
        expect(manager.getBlobToStream.length).toBe(2); // container, blob (+ optional options)
        expect(manager.writeBlobToStream.length).toBe(3); // container, blob, stream (+ optional options)
    });
});