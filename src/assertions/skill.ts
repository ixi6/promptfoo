import { matchesPattern } from './traceUtils';

import type { AssertionParams, GradingResult, SkillCallEntry } from '../types/index';

interface SkillCountValue {
  max?: number;
  min?: number;
  name?: string;
  pattern?: string;
}

function applyInverse(pass: boolean, inverse: boolean) {
  return inverse ? !pass : pass;
}

function getSkillCalls(params: AssertionParams): SkillCallEntry[] {
  const rawSkillCalls = params.providerResponse?.metadata?.skillCalls;
  if (!Array.isArray(rawSkillCalls)) {
    return [];
  }

  return rawSkillCalls.filter(
    (entry): entry is SkillCallEntry =>
      Boolean(entry) && typeof entry === 'object' && typeof entry.name === 'string',
  );
}

function matchesSkill(skillCall: SkillCallEntry, matcher: { name?: string; pattern?: string }) {
  if (matcher.name && skillCall.name !== matcher.name) {
    return false;
  }

  if (matcher.pattern && !matchesPattern(skillCall.name, matcher.pattern)) {
    return false;
  }

  return true;
}

function formatSkillCall(skillCall: SkillCallEntry): string {
  const details = [skillCall.source, skillCall.path].filter(Boolean).join(', ');
  return details ? `${skillCall.name} (${details})` : skillCall.name;
}

function resolveSkillMatchers(
  value: unknown,
):
  | { kind: 'list'; matchers: Array<{ name: string }> }
  | { kind: 'count'; matcher: SkillCountValue } {
  const normalizeText = (text: unknown) => (typeof text === 'string' ? text.trim() : undefined);

  if (typeof value === 'string' && value.trim()) {
    return {
      kind: 'list',
      matchers: [{ name: normalizeText(value)! }],
    };
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.trim())
  ) {
    return {
      kind: 'list',
      matchers: value.map((item) => ({ name: item.trim() })),
    };
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const matcher = value as SkillCountValue;
    const name = normalizeText(matcher.name);
    const pattern = normalizeText(matcher.pattern);
    if (!name && !pattern) {
      throw new Error('skill-used assertion object must include a name or pattern property');
    }

    return {
      kind: 'count',
      matcher: {
        max: typeof matcher.max === 'number' ? matcher.max : undefined,
        min: typeof matcher.min === 'number' ? matcher.min : undefined,
        name,
        pattern,
      },
    };
  }

  throw new Error('skill-used assertion must have a string, string array, or object value');
}

export function handleSkillUsed(params: AssertionParams): GradingResult {
  const skillCalls = getSkillCalls(params);
  const actualSkills = skillCalls.map(formatSkillCall);
  const expected = resolveSkillMatchers(params.renderedValue ?? params.assertion.value);

  if (expected.kind === 'list') {
    const missing = expected.matchers.filter(
      (matcher) => !skillCalls.some((skillCall) => matchesSkill(skillCall, matcher)),
    );
    const matched = expected.matchers.filter((matcher) =>
      skillCalls.some((skillCall) => matchesSkill(skillCall, matcher)),
    );
    const pass = params.inverse ? matched.length === 0 : missing.length === 0;
    const expectedSkills = expected.matchers.map((matcher) => matcher.name);
    const actualSummary = actualSkills.length > 0 ? actualSkills.join(', ') : '(none)';

    let reason: string;
    if (params.inverse) {
      reason = pass
        ? `Forbidden skill(s) were not used: ${expectedSkills.join(', ')}`
        : `Forbidden skill(s) were used: ${matched.map((matcher) => matcher.name).join(', ')}. Actual skills: ${actualSummary}`;
    } else if (pass) {
      reason = `Observed required skill(s): ${expectedSkills.join(', ')}. Actual skills: ${actualSummary}`;
    } else {
      reason = `Missing required skill(s): ${missing.map((matcher) => matcher.name).join(', ')}. Actual skills: ${actualSummary}`;
    }

    return {
      pass,
      score: pass ? 1 : 0,
      reason,
      assertion: params.assertion,
    };
  }

  const { matcher } = expected;
  const min = matcher.min ?? 1;
  const max = matcher.max;
  const matchingSkillCalls = skillCalls.filter((skillCall) => matchesSkill(skillCall, matcher));
  const count = matchingSkillCalls.length;
  const basePass = count >= min && (max === undefined || count <= max);
  const pass = applyInverse(basePass, params.inverse);
  const matcherLabel = matcher.pattern || matcher.name || '*';

  let reason = `Matched skill "${matcherLabel}" ${count} time(s)`;
  reason += max === undefined ? ` (expected at least ${min})` : ` (expected ${min}-${max})`;
  if (matchingSkillCalls.length > 0) {
    reason += `. Matches: ${matchingSkillCalls.map(formatSkillCall).join(', ')}`;
  }

  if (params.inverse) {
    reason = basePass
      ? `Skill "${matcherLabel}" matched ${count} time(s), which violates the inverse assertion`
      : `Skill "${matcherLabel}" did not satisfy the forbidden match condition`;
  }

  return {
    pass,
    score: pass ? 1 : 0,
    reason,
    assertion: params.assertion,
  };
}
