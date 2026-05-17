import type { EventEnvelope } from '@genesis-1/shared';

export type EventHandler = (event: EventEnvelope) => Promise<void> | void;

export interface Subscription {
  channel: string;
  handler: EventHandler;
  unsubscribe: () => Promise<void>;
}
