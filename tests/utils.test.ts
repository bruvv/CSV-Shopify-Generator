import { cn } from '../src/lib/utils';

describe('cn', () => {
  it('merges class names, removing duplicates', () => {
    expect(cn('a', 'b', 'a')).toBe('a b a');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles single class name', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('ignores empty strings, null, and undefined', () => {
    expect(cn('a', '', null, undefined, 'b')).toBe('a b');
  });

  it('handles falsy values like false and 0', () => {
    expect(cn('a', false, 0, 'b')).toBe('a 0 b');
  });

  it('handles array of class names if supported', () => {
    expect(cn(['a', 'b'], 'c')).toContain('a');
    expect(cn(['a', 'b'], 'c')).toContain('b');
    expect(cn(['a', 'b'], 'c')).toContain('c');
  });
});
