import { supabase } from '@/integrations/supabase/client';

export const categoryNameKey = (name: string) => name.trim().replace(/\s+/g, '').toLowerCase();

export async function loadSharedCategories() {
  return supabase.from('shared_menu_categories').select('id, name, display_order').order('name');
}

export async function addSharedCategory(name: string, displayOrder: number) {
  return supabase.from('shared_menu_categories').insert({ name: name.trim(), display_order: displayOrder });
}

export async function removeSharedCategory(id: string) {
  // ON DELETE SET NULL preserves items across every restaurant atomically.
  return supabase.from('shared_menu_categories').delete().eq('id', id);
}