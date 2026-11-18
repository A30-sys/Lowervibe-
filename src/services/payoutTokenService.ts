import { auth } from './firebase';

export interface ServerApprovalTokenResponse {
  ok: boolean;
  approvalToken?: string;
  tokenSignature?: string;
  issuedAt?: string;
  approvedBy?: string;
  criteriaSnapshot?: {
    publishedTracks: number;
    totalPlays: number;
    followersCount: number;
    copyrightStrikes: number;
  };
  error?: string;
}

export interface ServerPayoutTokenResponse {
  ok: boolean;
  requestId?: string;
  payoutToken?: string;
  tokenSignature?: string;
  txRef?: string;
  grossAmountMwk?: number;
  feeMwk?: number;
  netAmountMwk?: number;
  availableBalanceBeforeMwk?: number;
  status?: 'awaiting_review' | 'processing' | 'paid';
  providerConfigured?: boolean;
  issuedAt?: string;
  error?: string;
}

export interface ServerTokenVerifyResponse {
  ok: boolean;
  valid: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}

async function getBearerHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) {
    throw new Error('Authentication required: sign in again to obtain a verified security token.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function requestServerApprovalToken(
  artistId: string
): Promise<ServerApprovalTokenResponse> {
  try {
    const headers = await getBearerHeaders();
    const res = await fetch('/api/monetization/approve-token', {
      method: 'POST',
      headers,
      body: JSON.stringify({ artistId }),
    });
    const json = (await res.json()) as ServerApprovalTokenResponse;
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `Server approval check returned HTTP ${res.status}.`,
      };
    }
    return json;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to reach approval token service.',
    };
  }
}

export async function requestServerPayoutToken(input: {
  artistId: string;
  payoutMethodId: string;
  grossAmountMwk: number;
}): Promise<ServerPayoutTokenResponse> {
  try {
    const headers = await getBearerHeaders();
    const res = await fetch('/api/payouts/generate-token', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as ServerPayoutTokenResponse;
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || `Withdrawal token service returned HTTP ${res.status}.`,
      };
    }
    return json;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to reach payout token generator.',
    };
  }
}

export async function verifyServerToken(
  tokenSignature: string
): Promise<ServerTokenVerifyResponse> {
  try {
    const res = await fetch('/api/payouts/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenSignature }),
    });
    const json = (await res.json()) as ServerTokenVerifyResponse;
    return json;
  } catch (err) {
    return {
      ok: false,
      valid: false,
      error: err instanceof Error ? err.message : 'Token verification failed.',
    };
  }
}
