import { EventEmitter } from 'events';
import * as cq from 'concurrent-queue';
import { Queue } from '../models/queue';
import { QueuedCommandJob } from '../models/queued-command';
import { ErrorHelper } from './helpers/error.helper';

export interface QueuedCommandRunnerEvents {
    'error': (error: Error) => void;
    'queueProcessed': (job: PendingJob) => void;
    'startJob': (job: QueuedCommandJob) => void;
    'finishJob': (job: QueuedCommandJob) => void;
    'waitingForJobsToFinish': (pendingJobs: PendingJob[]) => void;
    'doneWaitingForJobsToFinish': () => void;
    'starting': () => void;
    'started': () => void;
    'stopping': () => void;
    'stopped': () => void;
    'cleaningUp': () => void;
    'cleanedUp': () => void;
}

export declare interface QueuedCommandRunner {
    on<U extends keyof QueuedCommandRunnerEvents>(
      event: U, listener: QueuedCommandRunnerEvents[U]
    ): this;
  
    emit<U extends keyof QueuedCommandRunnerEvents>(
      event: U, ...args: Parameters<QueuedCommandRunnerEvents[U]>
    ): boolean;
}

class PendingJob {
    public job: QueuedCommandJob;
    public jobPromise: Promise<void>;
    public error: Error;

    public constructor(job: QueuedCommandJob = null, error: Error = null, jobPromise: Promise<void> = null) {
        this.job = job;
        this.error = error;
        this.jobPromise = jobPromise;
    }
}

export interface QueuedCommandRunnerSettings {
    timeoutIdleMs: number;
    timeoutWorkingMs: number;
    autoStart: boolean;
    autoStopOnNoJobs: boolean;
}

export class QueuedCommandRunner extends EventEmitter {
    private queue: Queue<QueuedCommandJob> = null;
    private concurrentQueue: any = null;
    private concurrentQueueProcessFn: any = null;
    private pendingJobs: PendingJob[] = [];
    private previouslyHandledJob: QueuedCommandJob = null;
    private processing: boolean = false;
    private jobHandler: NodeJS.Timer = null;
    
    public settings: QueuedCommandRunnerSettings = null;

    public constructor(settings: QueuedCommandRunnerSettings = null) {
        super();
        this.queue = new Queue<QueuedCommandJob>();

        settings = {
            timeoutIdleMs: 250,
            timeoutWorkingMs: 50,
            autoStart: true,
            autoStopOnNoJobs: true,
            ...settings
        };

        this.settings = settings;
    }

    public addJob(commandJob: QueuedCommandJob): void {
        this.queue.push(commandJob);

        if (this.settings.autoStart && (!this.processing || !this.jobHandler)) {
            this.start();
        }
    }

    public start(): void {
        this.emit('starting');
        this.processing = true;
        
        if (!this.jobHandler) {
            this.jobHandler = setTimeout(() => {
                this.emit('started');
                this.handleJobs();
            }, this.settings.timeoutWorkingMs);
        }
    }

    public stop(): void {
        this.processing = false;
    }

    private async handleJobs(): Promise<void> {
        if (!this.processing) {
            this.emit('stopping');
            await this.cleanup();
            this.emit('stopped');
            return;
        }

        let noMoreJobs: boolean = await this.handleNextJob();
        if (this.settings.autoStopOnNoJobs && noMoreJobs) {
            this.processing = false;
            await this.cleanup();
            return;
        }

        this.jobHandler = setTimeout(() => {
            this.handleJobs();
        }, noMoreJobs ? this.settings.timeoutIdleMs : this.settings.timeoutWorkingMs);
    }

    private async cleanup(): Promise<void> {
        this.emit('cleaningUp');
        await this.waitForPendingJobsToFinish();

        this.pendingJobs = [];
        this.previouslyHandledJob = null;
        this.concurrentQueue = null;
        this.concurrentQueueProcessFn = null;
        this.jobHandler = null;
        this.emit('cleanedUp');
    }

    // Promise resolves once the next job is handled (true for no more jobs, false for more jobs)
    private async handleNextJob(): Promise<boolean> {
        let nextJob: QueuedCommandJob | undefined = this.queue.pop();
        if (!nextJob) {
            return true;
        }

        try {
            if (this.previouslyHandledJob && this.previouslyHandledJob.concurrencyGroup && this.previouslyHandledJob.concurrencyGroup.maxConcurrent > 1) {
                // Last job was concurrent //
    
                if (nextJob.concurrencyGroup && nextJob.concurrencyGroup.groupName === this.previouslyHandledJob.concurrencyGroup.groupName && this.concurrentQueue) {
                    // start job in the existing concurrent queue (should be quick) & move on
                    await this.startJobInQueue(nextJob);
                } else {
                    if (this.concurrentQueue) {
                        // wait for existing jobs in concurrent queue to finish, delete concurrent queue
                        await this.waitForPendingJobsToFinish();
                        delete this.concurrentQueue;
                        delete this.concurrentQueueProcessFn;
                        this.concurrentQueue = null;
                        this.concurrentQueueProcessFn = null;
                    }
    
                    if (nextJob.concurrencyGroup && nextJob.concurrencyGroup.maxConcurrent > 1) {
                        // start job concurrent & move on
                        await this.startJobInQueue(nextJob);
                    } else {
                        // start job not concurrent & wait 
                        let pendingJob: PendingJob = this.startJob(nextJob);
                        await pendingJob.jobPromise;
                    }
                }
            } else {
                // Last job was not concurrent //
    
                if (nextJob.concurrencyGroup && nextJob.concurrencyGroup.maxConcurrent > 1) {
                    // start job concurrent & move on
                    await this.startJobInQueue(nextJob);
                } else {
                    // start job not concurrent & wait 

                    let now = Date.now();
                    let pendingJob: PendingJob = this.startJob(nextJob);
                    await pendingJob.jobPromise;
                }
            }

            this.previouslyHandledJob = nextJob;
        } catch (err) {
            this.emit('error', ErrorHelper.isError(err) ? err : new Error(err));
        }
        
        return false;
    }

    private async waitForPendingJobsToFinish(): Promise<void> {
        if (!this.pendingJobs || this.pendingJobs.length === 0) {
            this.pendingJobs = [];
            return;
        }

        this.emit('waitingForJobsToFinish', this.pendingJobs);

        let jobPromises: Promise<void>[] = [];
        for (let pendingJob of this.pendingJobs) {
            jobPromises.push(pendingJob.jobPromise);
        }

        try {
            await Promise.all(jobPromises);
            this.emit('doneWaitingForJobsToFinish');
        } catch (err) {
            this.emit('error', ErrorHelper.isError(err) ? err : new Error(err));
        }

        this.pendingJobs = [];
        
        return;
    }

    private async startJobInQueue(job: QueuedCommandJob): Promise<void> {
        if (!this.concurrentQueue) {
            await this.waitForPendingJobsToFinish();
            this.concurrentQueue = cq.default();
            this.concurrentQueue.limit({concurrency: job.concurrencyGroup.maxConcurrent});
            this.concurrentQueueProcessFn = this.concurrentQueue.process(async (queuedJob: QueuedCommandJob) => {
                let pendingJob: PendingJob = this.startJob(queuedJob);
                if (!this.pendingJobs) {
                    this.pendingJobs = [];
                }
    
                this.pendingJobs.push(pendingJob);

                await pendingJob.jobPromise;
                
                return pendingJob;
            });
        }

        this.concurrentQueue(job).then((pendingJob: PendingJob) => {
            this.emit('queueProcessed', pendingJob);
        });

        return;
    }

    private startJob(job: QueuedCommandJob): PendingJob {
        this.emit('startJob', job);

        let pendingJob: PendingJob = new PendingJob();
        pendingJob.job = job;
        pendingJob.jobPromise = job.doWork().then(() => {
            this.emit('finishJob', job);
            return;
        });

        return pendingJob;
    }
}
