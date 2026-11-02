import { describe, expect, it } from 'vitest';
import { requiresAppUpdate } from './appUpdatePolicy';

describe('mandatory Android updates', () => {
  it('requires an update when the active APK has a newer build', () => {
    expect(requiresAppUpdate('1', 1005)).toBe(true);
  });
  it('allows the installed current build and newer builds', () => {
    expect(requiresAppUpdate('1005', 1005)).toBe(false);
    expect(requiresAppUpdate('1006', 1005)).toBe(false);
  });
  it('does not lock users out for unverified legacy releases or invalid build information', () => {
    expect(requiresAppUpdate('1', null)).toBe(false);
    expect(requiresAppUpdate('unknown', 1005)).toBe(false);
    expect(requiresAppUpdate('1', 2100000001)).toBe(false);
  });
});