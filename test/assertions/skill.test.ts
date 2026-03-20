import { describe, expect, it } from 'vitest';
import { runAssertion } from '../../src/assertions/index';

import type { Assertion, AtomicTestCase, ProviderResponse } from '../../src/types/index';

describe('skill-used assertion', () => {
  const testCase: AtomicTestCase = {
    vars: {},
  };

  const providerResponse: ProviderResponse = {
    output: 'Done',
    metadata: {
      skillCalls: [
        {
          name: 'token-skill',
          path: '.agents/skills/token-skill/SKILL.md',
          source: 'heuristic',
        },
        {
          name: 'project-standards:standards-check',
          source: 'tool',
        },
      ],
    },
  };

  async function runSkillAssertion(assertion: Assertion) {
    return runAssertion({
      assertion,
      test: testCase,
      providerResponse,
    });
  }

  it('passes when an exact skill name is present', async () => {
    const result = await runSkillAssertion({
      type: 'skill-used',
      value: 'token-skill',
    });

    expect(result.pass).toBe(true);
    expect(result.reason).toContain('Observed required skill(s): token-skill');
  });

  it('passes when all expected skills in a list are present', async () => {
    const result = await runSkillAssertion({
      type: 'skill-used',
      value: ['token-skill', 'project-standards:standards-check'],
    });

    expect(result.pass).toBe(true);
  });

  it('supports pattern matching with count thresholds', async () => {
    const result = await runSkillAssertion({
      type: 'skill-used',
      value: {
        pattern: 'project-*:*',
        min: 1,
        max: 1,
      },
    });

    expect(result.pass).toBe(true);
    expect(result.reason).toContain('Matched skill "project-*:*" 1 time(s)');
  });

  it('supports inverse assertions', async () => {
    const result = await runSkillAssertion({
      type: 'not-skill-used',
      value: 'forbidden-skill',
    });

    expect(result.pass).toBe(true);
  });

  it('fails when a required skill is missing', async () => {
    const result = await runSkillAssertion({
      type: 'skill-used',
      value: 'missing-skill',
    });

    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Missing required skill(s): missing-skill');
  });

  it('fails inverse assertions when a forbidden skill is used', async () => {
    const result = await runSkillAssertion({
      type: 'not-skill-used',
      value: 'token-skill',
    });

    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Forbidden skill(s) were used: token-skill');
  });

  it('throws when object values omit name and pattern', async () => {
    await expect(
      runSkillAssertion({
        type: 'skill-used',
        value: { min: 1 },
      }),
    ).rejects.toThrow('skill-used assertion object must include a name or pattern property');
  });
});
