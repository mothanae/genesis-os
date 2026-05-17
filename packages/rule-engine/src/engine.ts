import type { DatabaseClient } from '@genesis-1/database';
import type { EventPublisher } from '@genesis-1/event-bus';
import type { RuleDefinition, RuleSet, EvaluationResult, RuleViolation } from '@genesis-1/shared';
import { EventType } from '@genesis-1/shared';
import { ruleDefinitions, ruleSets, evaluationResults, violations } from '@genesis-1/database';
import { JsonLogicEvaluator } from './evaluator';
import { eq, and } from 'drizzle-orm';

export interface RuleEngineConfig {
  db: DatabaseClient;
  eventBus: EventPublisher;
}

export class RuleEngine {
  private readonly evaluator = new JsonLogicEvaluator();

  constructor(private readonly config: RuleEngineConfig) {}

  async evaluateRule(
    ruleId: string,
    context: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const rule = await this.config.db
      .select()
      .from(ruleDefinitions)
      .where(eq(ruleDefinitions.id, ruleId))
      .limit(1);
    const r = rule[0];

    if (!r) throw new Error('Rule not found');

    const matched = this.evaluator.evaluate(r.condition as Record<string, unknown>, context);

    const result = await this.config.db
      .insert(evaluationResults)
      .values({
        ruleId,
        targetType: 'manual',
        targetId: crypto.randomUUID(),
        matched,
        context,
      })
      .returning();

    if (matched && r.action) {
      const action = r.action as { type: string; severity?: string; message?: string };
      if (action.type === 'violation') {
        await this.createViolation(r, result[0]!.id, action);
      }
    }

    await this.config.eventBus.publish('genesis-1.rule.evaluation.completed', {
      id: crypto.randomUUID(),
      type: EventType.RuleEvaluationCompleted,
      source: 'rule-engine',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { ruleId, evaluationId: result[0]!.id, matched },
      metadata: { version: 1, priority: 'normal' },
    });

    return result[0] as unknown as EvaluationResult;
  }

  async evaluateRuleSet(
    ruleSetId: string,
    context: Record<string, unknown>,
  ): Promise<EvaluationResult[]> {
    const rules = await this.config.db
      .select()
      .from(ruleDefinitions)
      .where(
        and(eq(ruleDefinitions.ruleSetId, ruleSetId), eq(ruleDefinitions.enabled, true)),
      );

    const results: EvaluationResult[] = [];
    for (const rule of rules) {
      const result = await this.evaluateRule(rule.id, context);
      results.push(result);
    }
    return results;
  }

  async getViolations(projectId: string): Promise<RuleViolation[]> {
    const result = await this.config.db
      .select()
      .from(violations)
      .where(eq(violations.projectId, projectId));
    return result as unknown as RuleViolation[];
  }

  async resolveViolation(violationId: string): Promise<void> {
    await this.config.db
      .update(violations)
      .set({ resolvedAt: new Date() })
      .where(eq(violations.id, violationId));
  }

  private async createViolation(
    rule: typeof ruleDefinitions.$inferSelect,
    evaluationId: string,
    action: { severity?: string; message?: string },
  ): Promise<void> {
    await this.config.db.insert(violations).values({
      evaluationId,
      ruleId: rule.id,
      projectId: rule.projectId,
      severity: action.severity ?? 'warning',
      message: action.message ?? 'Rule violation detected',
    });

    await this.config.eventBus.publish('genesis-1.rule.violation.created', {
      id: crypto.randomUUID(),
      type: EventType.RuleViolationCreated,
      source: 'rule-engine',
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      projectId: rule.projectId,
      payload: { ruleId: rule.id, evaluationId, severity: action.severity, message: action.message },
      metadata: { version: 1, priority: 'normal' },
    });
  }
}
