import { patternSignature, type RepeatedPattern } from './analyzer';
import type { PatternReview } from './types';

export function choosePattern(
  patterns: RepeatedPattern[],
  reviews: PatternReview[],
  recentlyReviewedSignature?: string
): RepeatedPattern | undefined {
  const status = new Map(reviews.map(review => [review.signature, review.status]));
  const recent = patterns.find(pattern => patternSignature(pattern.sequence) === recentlyReviewedSignature);
  if (recent) return recent;
  return patterns.find(pattern => status.get(patternSignature(pattern.sequence)) === 'same_task')
    ?? patterns.find(pattern => status.get(patternSignature(pattern.sequence)) !== 'different_tasks');
}
