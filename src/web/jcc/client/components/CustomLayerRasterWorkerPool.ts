import { RasterMetadata, RasterReadResult } from "./CustomLayerRasterWorker";

export interface ReadRasterTask {
    taskData: RasterMetadata;
    transferables: Transferable[];
}

interface ReadRasterTaskWithHandlers {
    task: ReadRasterTask;
    resolve: (result: Blob) => void;
    reject: (reason: Error) => void;
}

export class CustomLayerRasterWorkerPool {
    private maxWorkers: number;
    private workerIdleLifetimeSecs: number;
    private workers: Map<Worker, number>; // Maps idle workers to their timeout IDs; null means "worker is busy"
    private queue: ReadRasterTaskWithHandlers[];
    private debug: boolean;

    constructor(maxWorkers: number, workerIdleLifetimeSecs: number) {
        this.debug = false;
        this.maxWorkers = maxWorkers;
        this.workerIdleLifetimeSecs = workerIdleLifetimeSecs;
        this.workers = new Map();
        this.queue = [];
    }

    queueTask(task: ReadRasterTask): Promise<any> {
        return new Promise((resolve, reject) => {
            const taskWithHandlers: ReadRasterTaskWithHandlers = { task, resolve, reject };
            const availableWorker = this.findAvailableWorker();
            if (availableWorker) {
                this.assignTaskToWorker(availableWorker, taskWithHandlers);
            } else if (this.workers.size < this.maxWorkers) {
                this.startWorker(taskWithHandlers);
            } else {
                this.queue.push(taskWithHandlers);
            }
        });
    }

    private findAvailableWorker(): Worker | null {
        for (let [worker, timeoutId] of this.workers) {
            if (timeoutId !== null) {
                this.debug && console.log("Clearing the raster transformation worker idle timer.");
                clearTimeout(timeoutId);
                this.workers.set(worker, null); // Mark as busy
                return worker;
            }
        }
        return null;
    }

    private assignTaskToWorker(worker: Worker, taskWithHandlers: ReadRasterTaskWithHandlers): void {
        worker.postMessage(taskWithHandlers.task.taskData, taskWithHandlers.task.transferables);
        worker.onmessage = (event: MessageEvent<RasterReadResult>) => {
            if (event.data.blob) {
                taskWithHandlers.resolve(event.data.blob);
            } else if (event.data.error?.error) {
                const error = event.data.error.error;
                const ex = new Error(event.data.error.message);
                ex.name = error.message;
                ex.stack = error.stack;
                taskWithHandlers.reject(ex);
            }
            this.handleWorkerIdle(worker);
        };
        worker.onerror = (event: ErrorEvent) => {
            console.error("Error trying to run CustomLayerRasterWorker: ", event);
            taskWithHandlers.reject(event.error);
            this.terminateWorker(worker);
        };
    }

    private startWorker(taskWithHandlers: ReadRasterTaskWithHandlers): void {
        const worker = new Worker("customLayerRasterWorker.js");
        this.workers.set(worker, null); // Mark as busy
        this.assignTaskToWorker(worker, taskWithHandlers);
    }

    private handleWorkerIdle(worker: Worker): void {
        if (this.queue.length > 0) {
            const nextTask = this.queue.shift()!;
            this.assignTaskToWorker(worker, nextTask);
        } else {
            // Set the worker to idle with a timeout
            this.debug && console.log("Setting the raster transformation worker idle timer.");
            const timeoutId = window.setTimeout(
                () => this.terminateWorker(worker),
                this.workerIdleLifetimeSecs * 1000,
            );
            this.workers.set(worker, timeoutId);
        }
    }

    private terminateWorker(worker: Worker): void {
        this.debug && console.log("Terminating raster transformation worker due to idle timeout.");
        worker.terminate();
        this.workers.delete(worker);
    }
}
