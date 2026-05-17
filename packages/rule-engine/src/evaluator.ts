type OperatorFn = (args: unknown[], context: Record<string, unknown>) => boolean;

const operators: Record<string, OperatorFn> = {
  eq: ([a, b]) => a === b,
  not_equal: ([a, b]) => a !== b,
  gt: ([a, b]) => (a as number) > (b as number),
  lt: ([a, b]) => (a as number) < (b as number),
  gte: ([a, b]) => (a as number) >= (b as number),
  lte: ([a, b]) => (a as number) <= (b as number),
  in: ([a, b]) => Array.isArray(b) && b.includes(a),
  not_in: ([a, b]) => Array.isArray(b) && !b.includes(a),
  contains: ([a, b]) => typeof a === 'string' && typeof b === 'string' && a.includes(b),
  starts_with: ([a, b]) => typeof a === 'string' && typeof b === 'string' && a.startsWith(b),
  ends_with: ([a, b]) => typeof a === 'string' && typeof b === 'string' && a.endsWith(b),
  matches: ([a, b]) => {
    try {
      return new RegExp(b as string).test(a as string);
    } catch {
      return false;
    }
  },
  and: (args, context) => args.every((arg) => evaluate(arg as RuleCondition, context)),
  or: (args, context) => args.some((arg) => evaluate(arg as RuleCondition, context)),
  not: ([arg], context) => !evaluate(arg as RuleCondition, context),
  all: ([args], context) =>
    ((args as Array<{ as?: string; condition?: RuleCondition }>) ?? []).every(
      (item) => evaluate(item.condition ?? {}, { ...context, [item.as ?? 'item']: item }),
    ),
  any: ([args], context) =>
    ((args as Array<{ as?: string; condition?: RuleCondition }>) ?? []).some(
      (item) => evaluate(item.condition ?? {}, { ...context, [item.as ?? 'item']: item }),
    ),
  none: ([args], context) =>
    !((args as Array<{ as?: string; condition?: RuleCondition }>) ?? []).some(
      (item) => evaluate(item.condition ?? {}, { ...context, [item.as ?? 'item']: item }),
    ),
  exists: ([a]) => a !== null && a !== undefined,
};

type RuleCondition = { [operator: string]: unknown[] | RuleCondition[] } | Record<string, unknown>;

function resolveVar(varPath: string, context: Record<string, unknown>): unknown {
  const path = varPath.replace(/^event\.?/, '').split('.');
  let current: unknown = context;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[key!];
  }
  return current;
}

export class JsonLogicEvaluator {
  private readonly customOps: Map<string, OperatorFn> = new Map();

  registerOperator(name: string, fn: OperatorFn): void {
    this.customOps.set(name, fn);
  }

  evaluate(condition: RuleCondition, context: Record<string, unknown>): boolean {
    return evaluate(condition, context, this.customOps);
  }
}

function evaluate(
  condition: RuleCondition,
  context: Record<string, unknown>,
  customOps?: Map<string, OperatorFn>,
): boolean {
  if (typeof condition !== 'object' || condition === null) return false;

  for (const [operator, args] of Object.entries(condition)) {
    // Handle "var" references
    if (operator === 'var') {
      const resolved = resolveVar(args as string, context);
      return resolved !== undefined && resolved !== false && resolved !== null;
    }

    // Handle regular operators
    const op = customOps?.get(operator) ?? operators[operator];
    if (!op) continue;

    const resolvedArgs = Array.isArray(args) ? args.map((arg) => {
      if (typeof arg === 'object' && arg !== null && 'var' in arg) {
        return resolveVar((arg as { var: string }).var, context);
      }
      return arg;
    }) : [];

    return op(resolvedArgs, context);
  }

  return false;
}
