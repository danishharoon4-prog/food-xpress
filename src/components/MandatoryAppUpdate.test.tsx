import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MandatoryAppUpdate from './MandatoryAppUpdate';

const mocks = vi.hoisted(() => ({
  native: vi.fn(() => true),
  info: vi.fn(),
  release: vi.fn(),
  listener: vi.fn(async () => ({ remove: vi.fn() })),
  from: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native, getPlatform: () => 'android' } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: mocks.info, addListener: mocks.listener } }));
vi.mock('@/components/DownloadApkButton', () => ({ DOWNLOAD_ENDPOINT: 'https://example.test/download-apk' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));

describe('installed Android update enforcement', () => {
  beforeEach(() => {
    mocks.native.mockReturnValue(true);
    mocks.info.mockResolvedValue({ version: '0.0.4', build: '1' });
    mocks.release.mockResolvedValue({ data: { id: 'release-5', version: '0.0.5', version_code: 1005, release_notes: null }, error: null });
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: mocks.release };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
  });
  afterEach(() => vi.clearAllMocks());

  it('keeps requiring installation after downloading and after Escape', async () => {
    render(<MandatoryAppUpdate />);
    const update = await screen.findByRole('link', { name: 'Update Now' });
    expect(update.getAttribute('href')).toContain('id=release-5');
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(update);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    mocks.info.mockResolvedValue({ version: '0.0.5', build: '1005' });
    fireEvent.click(screen.getByRole('button', { name: 'Check Installed Version' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('does not affect website users', async () => {
    mocks.native.mockReturnValue(false);
    render(<MandatoryAppUpdate />);
    await act(async () => {});
    expect(mocks.from).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});