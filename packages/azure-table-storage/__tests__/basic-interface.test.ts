import { AzureDocumentStorageManager, IAzureDocumentSavable, AzureBlobStorageManager } from '../src/main';

class TestDocument implements IAzureDocumentSavable {
    public partitionKey: string = 'test';
    public rowKey: string = 'test';
    public classVersion: number = 1;
    
    public handleVersionChange(inputObject: Object, inputVersion: number, latestVersion: number): boolean {
        return false;
    }
}

describe('Azure Table Storage Interface Tests', () => {
    test('AzureDocumentStorageManager can be instantiated', () => {
        const manager = new AzureDocumentStorageManager<TestDocument>(TestDocument, 'account', 'key');
        expect(manager).toBeDefined();
        expect(manager).toBeInstanceOf(AzureDocumentStorageManager);
    });

    test('AzureBlobStorageManager can be instantiated', () => {
        const manager = new AzureBlobStorageManager('account', 'key');
        expect(manager).toBeDefined();
        expect(manager).toBeInstanceOf(AzureBlobStorageManager);
    });

    test('Document interface is working', () => {
        const doc = new TestDocument();
        expect(doc.partitionKey).toBe('test');
        expect(doc.rowKey).toBe('test');
        expect(doc.classVersion).toBe(1);
        expect(doc.handleVersionChange({}, 1, 2)).toBe(false);
    });
});