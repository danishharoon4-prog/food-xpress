import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RestaurantProfile from './RestaurantProfile';

const state = vi.hoisted(() => ({
  restaurant: null as Record<string, unknown> | null,
  photoCallback: undefined as ((value: string) => void) | undefined,
  insert: vi.fn().mockResolvedValue({ error: null }),
  refetch: vi.fn().mockResolvedValue(undefined),
  profile: { id: 'owner-1', full_name: 'Restaurant Owner', phone: '03001234567', email: 'owner@example.test', city: 'Mansehra' },
}));
vi.mock('react-router-dom', () => ({ useOutletContext: () => ({ restaurant: state.restaurant, refetchRestaurant: state.refetch }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner-1' }, profile: state.profile, refreshProfile: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({
  insert: state.insert,
  update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }),
}) } }));
vi.mock('@/components/ReviewRemarks', () => ({ default: () => null }));
vi.mock('@/components/NotificationSettings', () => ({ NotificationSettings: () => null }));
vi.mock('@/components/AvatarUploader', () => ({ default: () => null }));
vi.mock('@/components/LocationPicker', () => ({ LocationPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input aria-label="Address" value={value} onChange={e => onChange(e.target.value)} /> }));
vi.mock('@/components/ImageCropInput', () => ({ default: ({ onChange }: { onChange: (v: string) => void }) => <button type="button" onClick={() => { state.photoCallback = onChange; }}>Select photo</button> }));

describe('restaurant profile edit safety', () => {
  beforeEach(() => { state.restaurant = null; state.photoCallback = undefined; state.insert.mockClear(); });

  it('preserves unsaved fields when realtime returns a new copy of the restaurant', async () => {
    state.restaurant = { id: 'restaurant-1', name: 'Existing restaurant', approval_status: 'approved' };
    const view = render(<RestaurantProfile />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Karachi Biryani House'), { target: { value: 'Unsaved name' } });
    state.restaurant = { ...state.restaurant, name: 'Server name' };
    view.rerender(<RestaurantProfile />);
    expect(screen.getByPlaceholderText('e.g. Karachi Biryani House')).toHaveValue('Unsaved name');
  });

  it('submits the completed profile without a delayed photo callback discarding newer fields', async () => {
    render(<RestaurantProfile />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Select photo' })[1]);
    fireEvent.change(screen.getByPlaceholderText('e.g. Karachi Biryani House'), { target: { value: 'Fresh Kitchen' } });
    fireEvent.change(screen.getByPlaceholderText('Tell customers about your restaurant...'), { target: { value: 'Pizza and burgers' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Pakistani'), { target: { value: 'Pakistani' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), { target: { value: 'Main Road, Mansehra' } });
    act(() => state.photoCallback?.('https://example.test/cover.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit for Approval' }));
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'owner-1', name: 'Fresh Kitchen', description: 'Pizza and burgers',
      cuisine_type: 'Pakistani', address: 'Main Road, Mansehra', image_url: 'https://example.test/cover.jpg',
      approval_status: 'pending', is_active: false,
    })));
  });
});