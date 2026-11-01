import { describe, expect, it } from 'vitest';
import { canApplyMobileUpdate } from './mobileUpdateSafety';

describe('mobile profile update protection', () => {
  it('never reloads restaurant setup even after returning from camera without focus', () => {
    expect(canApplyMobileUpdate('/restaurant/profile', false, false)).toBe(false);
    expect(canApplyMobileUpdate('/restaurant/profile/', false, false)).toBe(false);
  });
  it('still allows updates away from the profile when visible and idle', () => {
    expect(canApplyMobileUpdate('/restaurants', false, false)).toBe(true);
    expect(canApplyMobileUpdate('/restaurants', true, false)).toBe(false);
    expect(canApplyMobileUpdate('/restaurants', false, true)).toBe(false);
  });
});