import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { SupabaseStorageEngine } from '../engines/SupabaseStorageEngine';

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  single: vi.fn(),
  verification: vi.fn(),
  assignments: vi.fn(),
  mutation: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  AuthError: class AuthError extends Error {},
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
      signInAnonymously: mocks.signInAnonymously,
    },
    from: () => {
      let operation: 'select' | 'update' | 'upsert' | null = null;
      let selectedFields: string | undefined;
      const query = {
        select: (fields?: string) => { operation = 'select'; selectedFields = fields; return query; },
        eq: () => query,
        single: mocks.single,
        update: () => { operation = 'update'; return query; },
        upsert: () => { operation = 'upsert'; return query; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(
          operation === 'update' || operation === 'upsert'
            ? mocks.mutation()
            : operation === 'select'
              ? selectedFields === '*' ? mocks.verification() : mocks.assignments()
              : { error: null },
        ).then(resolve, reject),
      };
      return query;
    },
    storage: {
      from: () => ({ download: mocks.download }),
    },
  }),
}));

describe('SupabaseStorageEngine safety failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'test' } } } });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.mutation.mockResolvedValue({ error: null });
    mocks.single.mockResolvedValue({ data: { data: { participantId: 'participant' } }, error: null });
    mocks.verification.mockResolvedValue({ data: [], error: null });
    mocks.assignments.mockResolvedValue({ data: [], error: null });
  });

  test('treats a Storage API 404 as a missing object', async () => {
    mocks.download.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Object not found'), { statusCode: '404' }),
    });
    const engine = new SupabaseStorageEngine(true);

    // @ts-expect-error protected method exercised directly
    await expect(engine._getFromStorage('record', 'participantData')).resolves.toEqual({});
  });

  test('rejects non-404 storage errors instead of treating them as missing', async () => {
    mocks.download.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Service unavailable'), { statusCode: '503' }),
    });
    const engine = new SupabaseStorageEngine(true);

    // @ts-expect-error protected method exercised directly
    await expect(engine._getFromStorage('record', 'participantData')).rejects.toThrow('Failed to download from Supabase');
  });

  test('rejects storage errors without an HTTP status code', async () => {
    mocks.download.mockResolvedValue({ data: null, error: new Error('Network failure') });
    const engine = new SupabaseStorageEngine(true);

    // @ts-expect-error protected method exercised directly
    await expect(engine._getFromStorage('record', 'participantData')).rejects.toThrow('Failed to download from Supabase');
  });

  test('rejects failed database initialization and leaves studyId unset', async () => {
    mocks.mutation.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
    const engine = new SupabaseStorageEngine(true);

    await expect(engine.initializeStudyDb('study')).rejects.toThrow('Failed to initialize study DB');

    // @ts-expect-error protected property checked directly
    expect(engine.studyId).toBeUndefined();
  });

  test('rejects failed anonymous sign-in without attempting database initialization', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signInAnonymously.mockResolvedValue({ error: new Error('Auth unavailable') });
    const engine = new SupabaseStorageEngine(true);

    await expect(engine.initializeStudyDb('study')).rejects.toThrow('Failed to sign in anonymously');
    expect(mocks.mutation).not.toHaveBeenCalled();
    // @ts-expect-error protected property checked directly
    expect(engine.studyId).toBeUndefined();
  });

  test('rejects participant completion when Supabase returns an update error', async () => {
    const engine = new SupabaseStorageEngine(true);
    await engine.initializeStudyDb('study');
    // @ts-expect-error set protected identity for the focused primitive test
    engine.currentParticipantId = 'participant';
    mocks.mutation.mockResolvedValue({ error: { message: 'write denied' } });

    // @ts-expect-error protected primitive exercised directly
    await expect(engine._completeCurrentParticipantRealtime()).rejects.toThrow('Failed to complete participant');
  });

  test('rejects sequence assignment creation when Supabase returns an upsert error', async () => {
    const engine = new SupabaseStorageEngine(true);
    await engine.initializeStudyDb('study');
    mocks.mutation.mockResolvedValue({ error: { message: 'write denied' } });

    // @ts-expect-error protected primitive exercised directly
    await expect(engine._createSequenceAssignment('participant', {} as never, false))
      .rejects.toThrow('Failed to create sequence assignment');
  });

  test('rejects config-hash updates when Supabase returns an upsert error', async () => {
    const engine = new SupabaseStorageEngine(true);
    await engine.initializeStudyDb('study');
    mocks.mutation.mockResolvedValue({ error: { message: 'write denied' } });

    // @ts-expect-error protected primitive exercised directly
    await expect(engine._setCurrentConfigHash('hash')).rejects.toThrow('Failed to update current config hash');
  });

  test('returns null for a genuinely missing sequence assignment', async () => {
    const engine = new SupabaseStorageEngine(true);
    await engine.initializeStudyDb('study');

    // @ts-expect-error protected primitive exercised directly
    await expect(engine._getSequenceAssignment('missing-participant')).resolves.toBeNull();
  });

  test('throws on assignment query errors instead of treating them as missing', async () => {
    const engine = new SupabaseStorageEngine(true);
    await engine.initializeStudyDb('study');
    mocks.assignments.mockResolvedValue({ data: null, error: { message: 'network unavailable' } });

    // @ts-expect-error protected primitive exercised directly
    await expect(engine._getSequenceAssignment('participant')).rejects.toThrow('Failed to retrieve sequence assignment');
  });
});
