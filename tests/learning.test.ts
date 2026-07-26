import { describe, expect, it } from 'vitest';
import { choosePattern } from '../src/learning';
import type { RepeatedPattern } from '../src/analyzer';
import type { PatternReview } from '../src/types';

const patterns: RepeatedPattern[] = [
  { sequence: ['reddit', 'chatgpt', 'claude'], occurrences: 3, sessionCount: 2 },
  { sequence: ['mail', 'calendar'], occurrences: 2, sessionCount: 2 }
];

const review = (signature: string, status: PatternReview['status']): PatternReview => ({ signature, status, updatedAt: 1 });

describe('local pattern learning', () => {
  it('prioritizes a confirmed workflow', () => {
    expect(choosePattern(patterns, [review('mail→calendar', 'same_task')])?.sequence).toEqual(['mail', 'calendar']);
  });

  it('hides patterns marked as different tasks', () => {
    expect(choosePattern(patterns, [review('reddit→chatgpt→claude', 'different_tasks')])?.sequence).toEqual(['mail', 'calendar']);
  });

  it('temporarily keeps a newly dismissed pattern visible to explain the result', () => {
    expect(choosePattern(patterns, [review('reddit→chatgpt→claude', 'different_tasks')], 'reddit→chatgpt→claude')?.sequence).toEqual(['reddit', 'chatgpt', 'claude']);
  });
});
