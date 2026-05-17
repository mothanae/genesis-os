import { describe, it, expect } from 'vitest';
import { JsonLogicEvaluator } from '../evaluator';

describe('JsonLogicEvaluator', () => {
  const evaluator = new JsonLogicEvaluator();

  it('evaluates equality', () => {
    expect(evaluator.evaluate({ eq: [1, 1] }, {})).toBe(true);
    expect(evaluator.evaluate({ eq: [1, 2] }, {})).toBe(false);
    expect(evaluator.evaluate({ eq: ['hello', 'hello'] }, {})).toBe(true);
  });

  it('evaluates not_equal', () => {
    expect(evaluator.evaluate({ not_equal: [1, 2] }, {})).toBe(true);
    expect(evaluator.evaluate({ not_equal: [1, 1] }, {})).toBe(false);
  });

  it('evaluates greater_than / less_than', () => {
    expect(evaluator.evaluate({ gt: [5, 3] }, {})).toBe(true);
    expect(evaluator.evaluate({ gt: [3, 5] }, {})).toBe(false);
    expect(evaluator.evaluate({ lt: [3, 5] }, {})).toBe(true);
    expect(evaluator.evaluate({ gte: [5, 5] }, {})).toBe(true);
    expect(evaluator.evaluate({ lte: [3, 5] }, {})).toBe(true);
  });

  it('evaluates in / not_in', () => {
    expect(evaluator.evaluate({ in: [2, [1, 2, 3]] }, {})).toBe(true);
    expect(evaluator.evaluate({ in: [4, [1, 2, 3]] }, {})).toBe(false);
    expect(evaluator.evaluate({ not_in: [4, [1, 2, 3]] }, {})).toBe(true);
  });

  it('evaluates contains / starts_with / ends_with', () => {
    expect(evaluator.evaluate({ contains: ['hello world', 'world'] }, {})).toBe(true);
    expect(evaluator.evaluate({ contains: ['hello', 'xyz'] }, {})).toBe(false);
    expect(evaluator.evaluate({ starts_with: ['Genesis', 'Gen'] }, {})).toBe(true);
    expect(evaluator.evaluate({ ends_with: ['TypeScript', 'Script'] }, {})).toBe(true);
  });

  it('evaluates matches (regex)', () => {
    expect(evaluator.evaluate({ matches: ['abc123', '^[a-z]+\\d+$'] }, {})).toBe(true);
    expect(evaluator.evaluate({ matches: ['abc', '^\\d+$'] }, {})).toBe(false);
  });

  it('evaluates and / or / not combinators', () => {
    expect(evaluator.evaluate({ and: [{ eq: [1, 1] }, { eq: [2, 2] }] }, {})).toBe(true);
    expect(evaluator.evaluate({ and: [{ eq: [1, 1] }, { eq: [2, 3] }] }, {})).toBe(false);
    expect(evaluator.evaluate({ or: [{ eq: [1, 2] }, { eq: [2, 2] }] }, {})).toBe(true);
    expect(evaluator.evaluate({ not: { eq: [1, 2] } }, {})).toBe(true);
  });

  it('evaluates all / any / none', () => {
    const items = [{ val: 10 }, { val: 20 }, { val: 30 }];
    const context = { items };
    // all items have val >= 10
    expect(evaluator.evaluate({ all: [{ var: 'items' }, { gte: [{ var: 'val' }, 10] }] }, context)).toBe(true);
    // any item has val > 25
    expect(evaluator.evaluate({ any: [{ var: 'items' }, { gt: [{ var: 'val' }, 25] }] }, context)).toBe(true);
    // no item has val > 100
    expect(evaluator.evaluate({ none: [{ var: 'items' }, { gt: [{ var: 'val' }, 100] }] }, context)).toBe(true);
  });

  it('resolves nested var paths', () => {
    const context = { event: { payload: { type: 'service', name: 'MyService' } } };
    expect(evaluator.evaluate({ eq: [{ var: 'event.payload.type' }, 'service'] }, context)).toBe(true);
    expect(evaluator.evaluate({ eq: [{ var: 'event.payload.name' }, 'OtherService'] }, context)).toBe(false);
  });

  it('handles missing context gracefully', () => {
    expect(evaluator.evaluate({ eq: [{ var: 'nonexistent.path' }, 'value'] }, {})).toBe(false);
  });

  it('returns false for null condition', () => {
    expect(evaluator.evaluate(null as never, {})).toBe(false);
    expect(evaluator.evaluate({} as never, {})).toBe(false);
  });

  it('supports custom operators', () => {
    evaluator.registerOperator('is_even', ([a]) => (a as number) % 2 === 0);
    expect(evaluator.evaluate({ is_even: [4] }, {})).toBe(true);
    expect(evaluator.evaluate({ is_even: [5] }, {})).toBe(false);
  });
});
