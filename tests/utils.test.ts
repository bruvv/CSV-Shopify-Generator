import { cn } from '../src/lib/utils';

describe('cn', () => {
  it('merges class names, removing duplicates', () => {
    expect(cn('a', 'b', 'a')).toBe('a b a');
  });
});
