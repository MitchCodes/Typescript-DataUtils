// tslint:disable-next-line: no-unnecessary-class
export class AzureStorageUtilities {
    // tslint:disable-next-line:function-name
    public static buildConnectionString(ip: string = '127.0.0.1', blobport: number = 10000, queueport: number = 10001, tableport: number = 10002, 
                                        accountName: string = 'devstoreaccount1',
                                        accountKey: string = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='): string {
        let returnString = '';

        returnString += 'DefaultEndpointsProtocol=http;AccountName=' + accountName + ';';
        returnString += 'AccountKey=' + accountKey + ';';
        returnString += 'BlobEndpoint=http://' + ip + ':' + blobport + '/' + accountName + ';';
        returnString += 'TableEndpoint=http://' + ip + ':' + tableport + '/' + accountName + ';';
        returnString += 'QueueEndpoint=http://' + ip + ':' + queueport + '/' + accountName + ';';

        return returnString;
    }
}
