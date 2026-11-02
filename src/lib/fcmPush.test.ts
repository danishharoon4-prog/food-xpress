import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callbacks: new Map<string, (event: any) => unknown>(),
  removed: vi.fn(),
  session: { user: { id: 'account-a' } },
  rpc: vi.fn(),
  deleteToken: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
}));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: async () => ({ receive: 'granted' }),
    addListener: async (name: string, callback: (event: any) => unknown) => {
      mocks.callbacks.set(name, callback);
      return { remove: async () => { mocks.removed(name); mocks.callbacks.delete(name); } };
    },
    register: mocks.register,
  },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: mocks.session } }) },
    rpc: mocks.rpc,
    from: () => ({ delete: () => ({ eq: (_key: string, token: string) => ({
      eq: (_ownerKey: string, userId: string) => mocks.deleteToken(token, userId),
    }) }) }),
  },
}));

const flushWrites = async () => { await new Promise((resolve) => setTimeout(resolve, 0)); };

describe('native push account switching', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_FCM_ENABLED', 'true');
    mocks.callbacks.clear();
    mocks.session = { user: { id: 'account-a' } };
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.deleteToken.mockResolvedValue({ error: null });
    mocks.register.mockImplementation(async () => {
      mocks.callbacks.get('registration')?.({ value: 'same-phone-token' });
    });
  });

  it('captures an immediate native registration event and uses the caller-scoped RPC', async () => {
    const { registerFcmForCurrentUser } = await import('./fcmPush');
    await registerFcmForCurrentUser('account-a');
    await flushWrites();
    expect(mocks.rpc).toHaveBeenCalledWith('register_device_push_token', {
      _token: 'same-phone-token', _platform: 'android',
    });
  });

  it('registers the same token for the next account and ignores the old listener', async () => {
    const { registerFcmForCurrentUser } = await import('./fcmPush');
    await registerFcmForCurrentUser('account-a');
    await flushWrites();
    const oldCallback = mocks.callbacks.get('registration');
    mocks.session = { user: { id: 'account-b' } };
    await registerFcmForCurrentUser('account-b');
    await flushWrites();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.removed).toHaveBeenCalledTimes(4);
    oldCallback?.({ value: 'stale-account-token' });
    await flushWrites();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it('detaches only this phone from the signed-in account on logout', async () => {
    const { registerFcmForCurrentUser, unregisterFcmToken } = await import('./fcmPush');
    await registerFcmForCurrentUser('account-a');
    await flushWrites();
    await unregisterFcmToken();
    expect(mocks.deleteToken).toHaveBeenCalledWith('same-phone-token', 'account-a');
    expect(mocks.callbacks.size).toBe(0);
  });

  it('waits for an in-flight token save before logout cleanup', async () => {
    let finishSave: ((value: { error: null }) => void) | undefined;
    mocks.rpc.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    const { registerFcmForCurrentUser, unregisterFcmToken } = await import('./fcmPush');
    await registerFcmForCurrentUser('account-a');
    await flushWrites();
    const cleanup = unregisterFcmToken();
    await flushWrites();
    expect(mocks.deleteToken).not.toHaveBeenCalled();
    finishSave?.({ error: null });
    await cleanup;
    expect(mocks.deleteToken).toHaveBeenCalledWith('same-phone-token', 'account-a');
  });

  it('reports returned save errors and permits registration retry', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ error: { code: '42501' } });
    const { registerFcmForCurrentUser } = await import('./fcmPush');
    await registerFcmForCurrentUser('account-a');
    await flushWrites();
    expect(errorLog).toHaveBeenCalled();
    await registerFcmForCurrentUser('account-a');
    await flushWrites();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });
});