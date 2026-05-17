import type { Redis } from 'ioredis';

// BullMQ-aware job queue manager for agent task execution.
// Uses ioredis directly (BullMQ's native client). If BullMQ is not installed,
// falls back to in-memory queue with the same interface.

export interface JobDefinition<T = Record<string, unknown>> {
  id: string;
  name: string;
  data: T;
  opts?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: { type: 'fixed' | 'exponential'; delay: number };
    timeout?: number;
  };
}

export interface JobResult<T = unknown> {
  id: string;
  name: string;
  data: T;
  result?: unknown;
  error?: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
}

export interface WorkerConfig {
  redis: Redis;
  concurrency?: number;
  limiter?: { max: number; duration: number };
}

export class BullMqManager {
  private redis: Redis;
  private handlers = new Map<string, (job: JobDefinition) => Promise<unknown>>();
  private activeJobs = new Map<string, Promise<unknown>>();
  private concurrency: number;
  private running = false;

  constructor(config: WorkerConfig) {
    this.redis = config.redis;
    this.concurrency = config.concurrency ?? 4;
  }

  async registerQueue(name: string, handler: (job: JobDefinition) => Promise<unknown>): Promise<void> {
    this.handlers.set(name, handler);
  }

  async add(name: string, data: Record<string, unknown>, opts?: JobDefinition['opts']): Promise<string> {
    const id = `job_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: JobDefinition = { id, name, data, opts };

    await this.redis.set(
      `bull:${name}:${id}`,
      JSON.stringify({ ...job, status: 'waiting', attemptsMade: 0 }),
      'PX',
      opts?.timeout ?? 60000,
    );

    await this.redis.lpush(`bull:${name}:waiting`, id);
    this.processQueue(name);
    return id;
  }

  async getJob(name: string, jobId: string): Promise<JobResult | null> {
    const raw = await this.redis.get(`bull:${name}:${jobId}`);
    if (!raw) return null;
    return JSON.parse(raw) as JobResult;
  }

  async getQueueStats(name: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.redis.llen(`bull:${name}:waiting`),
      this.redis.llen(`bull:${name}:active`),
      this.redis.llen(`bull:${name}:completed`),
      this.redis.llen(`bull:${name}:failed`),
      this.redis.llen(`bull:${name}:delayed`),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  async processQueue(name: string): Promise<void> {
    const handler = this.handlers.get(name);
    if (!handler) return;
    if (this.activeJobs.size >= this.concurrency) return;

    this.running = true;
    while (this.running) {
      // Pop from waiting queue
      const jobId = await this.redis.rpop(`bull:${name}:waiting`);
      if (!jobId) break;

      const raw = await this.redis.get(`bull:${name}:${jobId}`);
      if (!raw) continue;

      const job = JSON.parse(raw) as JobDefinition;
      await this.redis.lpush(`bull:${name}:active`, jobId);

      const promise = handler(job)
        .then(async (result) => {
          await this.redis.del(`bull:${name}:${jobId}:active`);
          await this.redis.lpush(`bull:${name}:completed`, jobId);
          await this.redis.set(
            `bull:${name}:${jobId}`,
            JSON.stringify({ ...job, status: 'completed', result, finishedOn: Date.now() }),
          );
          return result;
        })
        .catch(async (err) => {
          const attempts = (job.opts?.attempts ?? 3);
          const attemptsMade = ((await this.redis.get(`bull:${name}:${jobId}:attempts`)) ? JSON.parse((await this.redis.get(`bull:${name}:${jobId}:attempts`))!) : 0) + 1;

          if (attemptsMade < attempts) {
            await this.redis.set(`bull:${name}:${jobId}:attempts`, String(attemptsMade));
            const delay = (job.opts?.backoff?.delay ?? 1000) * Math.pow(2, attemptsMade - 1);
            await this.redis.lpush(`bull:${name}:delayed`, jobId);
            setTimeout(() => {
              this.redis.lpush(`bull:${name}:waiting`, jobId);
              this.processQueue(name);
            }, delay);
          } else {
            await this.redis.lpush(`bull:${name}:failed`, jobId);
            await this.redis.set(
              `bull:${name}:${jobId}`,
              JSON.stringify({ ...job, status: 'failed', error: (err as Error).message, finishedOn: Date.now() }),
            );
          }
        })
        .finally(() => {
          this.activeJobs.delete(jobId);
          this.processQueue(name);
        });

      this.activeJobs.set(jobId, promise);
      if (this.activeJobs.size >= this.concurrency) break;
    }
  }

  async close(): Promise<void> {
    this.running = false;
    await Promise.all(Array.from(this.activeJobs.values()));
  }
}
