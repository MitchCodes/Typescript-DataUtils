// Azure Storage Manager - Documents
export { IAzureDocumentSavable, AzureDocumentResult,
        IAzureDocumentBatch, AzureDocumentBatch, AzureDocumentBatchResult, AzureDocumentBatchResults,
        AzureDocumentBatchType, AzureDocumentStorageManager, AzureTableDocumentCacheInMemory, AzureDocumentIdentifier, AzureDocumentCacheData, 
        AzureDocumentTableCacheData, IAzureDocumentCache } from './data/azure-document-storagemanager.logic';

export { AzureBlobOperationResult, AzureBlobStorageManager } from './data/azure-blob-storagemanager.logic';

export { AzureApplicationInsightsWinstonTransport } from './data/applicationinsights-winston-transport';

export { GenericTableDocumentDataService } from './data/generictable-document.dataservice';

export { TableStorageObjectConverter } from './models/table-storage-object-converter';
export { TableStorageArrayConverter } from './converters/table-storage/table-storage-array-converter';
export { TableStorageObjectTypeConverter } from './converters/table-storage/table-storage-object-converter';