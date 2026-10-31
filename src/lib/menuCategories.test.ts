import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSharedCategory, categoryNameKey, loadSharedCategories, removeSharedCategory } from './menuCategories';

const mocks = vi.hoisted(() => {
  const result = { data: [{ id: 'pizza-shared', name: 'Pizza', display_order: 0 }], error: null };
  const eq = vi.fn().mockResolvedValue({ error: null });
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ order }));
  const insert = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, insert, delete: del }));
  return { from, select, order, insert, del, eq };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));

describe('Shared menu categories', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns the same Pizza category for different restaurant menus without a restaurant filter', async () => {
    const firstRestaurant = await loadSharedCategories();
    const secondRestaurant = await loadSharedCategories();
    expect(firstRestaurant.data?.[0].id).toBe('pizza-shared');
    expect(secondRestaurant.data?.[0].id).toBe('pizza-shared');
    expect(mocks.from.mock.calls).toEqual([['shared_menu_categories'], ['shared_menu_categories']]);
    expect(mocks.eq).not.toHaveBeenCalled();
  });
  it('adds categories to the shared list without assigning them to a restaurant', async () => {
    await addSharedCategory(' BBQ ', 3);
    expect(mocks.from).toHaveBeenCalledWith('shared_menu_categories');
    expect(mocks.insert).toHaveBeenCalledWith({ name: 'BBQ', display_order: 3 });
  });
  it('removes the shared category without deleting or updating restaurant menu items', async () => {
    await removeSharedCategory('pizza-shared');
    expect(mocks.from.mock.calls).toEqual([['shared_menu_categories']]);
    expect(mocks.del).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith('id', 'pizza-shared');
  });
  it('prevents separate categories for case and spacing variations', () => {
    expect(categoryNameKey(' Milk Shake ')).toBe(categoryNameKey('milkshake'));
    expect(categoryNameKey('Pizza')).not.toBe(categoryNameKey('BBQ'));
  });
});