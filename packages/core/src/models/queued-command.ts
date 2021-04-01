export class QueuedCommandJob {
    public name: string;
    public doWork: () => Promise<void>;
    public concurrencyGroup: QueuedCommandConcurrencyGroup;

    public constructor(name: string = '', doWork: () => Promise<void> = null, concurrentGroupName: string = null, maxConcurrent: number = 0) {
        if (name) {
            this.name = name;
        }

        if (doWork) {
            this.doWork = doWork;
        }

        if (concurrentGroupName && maxConcurrent > 1) {
            this.concurrencyGroup = new QueuedCommandConcurrencyGroup();
            this.concurrencyGroup.groupName = concurrentGroupName;
            this.concurrencyGroup.maxConcurrent = maxConcurrent;
        }
    }
}

export class QueuedCommandConcurrencyGroup {
    public groupName: string;
    public maxConcurrent: number;
}
