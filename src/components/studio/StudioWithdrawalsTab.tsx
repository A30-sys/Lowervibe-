import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { verifyServerToken } from '../../services/payoutTokenService';
import {
  Artist,
  MonetizationConfig,
  PayoutMethod,
  PayoutProviderType,
  PayoutRequest,
} from '../../types';
import { CountUpValue } from './CountUpValue';

interface StudioWithdrawalsTabProps {
  currentArtist: Artist | null;
  isMonetized: boolean;
  monetizationStatus: string;
  allEligible: boolean;
  monetizationConfig: MonetizationConfig;
  availableBalanceMwk: number;
  computedEarningsMwk: number;
  payoutMethods: PayoutMethod[];
  payoutRequests: PayoutRequest[];
  earningsRefreshKey: number;
  isRefreshingEarnings: boolean;
  onRefreshEarnings: () => void;
  onOpenMonetizationTab: () => void;
  onAddPayoutMethod: (input: {
    type: PayoutProviderType;
    identifier: string;
    accountHolderName: string;
    artistId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onSubmitWithdrawal: (input: {
    artistId: string;
    artistName: string;
    payoutMethodId: string;
    grossAmountMwk: number;
  }) => Promise<{ success: boolean; error?: string; request?: PayoutRequest }>;
  onRequireReauth: (message: string) => Promise<boolean>;
  onShowNotice: (text: string, type?: 'ok' | 'err') => void;
}

type HistoryFilter = 'all' | 'paid' | 'processing' | 'awaiting_review' | 'failed';

export const StudioWithdrawalsTab: React.FC<StudioWithdrawalsTabProps> = ({
  currentArtist,
  isMonetized,
  monetizationStatus,
  allEligible,
  monetizationConfig,
  availableBalanceMwk,
  computedEarningsMwk,
  payoutMethods,
  payoutRequests,
  earningsRefreshKey,
  isRefreshingEarnings,
  onRefreshEarnings,
  onOpenMonetizationTab,
  onAddPayoutMethod,
  onSubmitWithdrawal,
  onRequireReauth,
  onShowNotice,
}) => {
  const { language } = useLanguage();
  const isNy = language === 'ny';

  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestIssuedRequest, setLatestIssuedRequest] = useState<PayoutRequest | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifiedResults, setVerifiedResults] = useState<Record<string, boolean>>({});

  // Quick inline payout method form
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [pmType, setPmType] = useState<PayoutProviderType>('airtel_money');
  const [pmIdentifier, setPmIdentifier] = useState('');
  const [pmHolderName, setPmHolderName] = useState(currentArtist?.name || '');
  const [isAddingPm, setIsAddingPm] = useState(false);

  const activeMethodId =
    selectedMethodId ||
    payoutMethods.find((m) => m.isDefault)?.id ||
    payoutMethods[0]?.id ||
    '';

  const summaryStats = useMemo(() => {
    const paidRequests = payoutRequests.filter((r) => r.status === 'paid');
    const pendingRequests = payoutRequests.filter(
      (r) => r.status === 'processing' || r.status === 'awaiting_review'
    );
    const totalPaidMwk = paidRequests.reduce((sum, r) => sum + (r.netAmountMwk || 0), 0);
    const totalPendingMwk = pendingRequests.reduce((sum, r) => sum + (r.grossAmountMwk || 0), 0);
    return {
      paidCount: paidRequests.length,
      pendingCount: pendingRequests.length,
      totalPaidMwk,
      totalPendingMwk,
    };
  }, [payoutRequests]);

  const filteredRequests = useMemo(() => {
    const sorted = [...payoutRequests].sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
    if (historyFilter === 'all') return sorted;
    return sorted.filter((r) => r.status === historyFilter);
  }, [payoutRequests, historyFilter]);

  const acceptedMethodsCount = payoutMethods.filter(
    (m) => m.status === 'accepted' || new Date(m.payoutHoldUntil).getTime() <= Date.now()
  ).length;

  const withdrawalStatusLabel = !isMonetized
    ? monetizationStatus === 'pending'
      ? isNy
        ? 'Malipiro akuyang\'aniridwa'
        : 'Monetization under review'
      : isNy
      ? 'Zotsekedwa mpaka mutakwaniritsa zofunikira'
      : 'Locked until eligible'
    : payoutMethods.length === 0
    ? isNy
      ? 'Ikani njira yolandirira ndalama'
      : 'Add a payout method'
    : acceptedMethodsCount > 0 || monetizationConfig.payoutProviderConfigured
    ? isNy
      ? 'Okonzeka kutenga ndalama'
      : 'Ready for withdrawals'
    : isNy
    ? 'Njira ili pa chitetezo'
    : 'Method security hold active';

  const minThresholdPct = Math.min(
    100,
    Math.round((availableBalanceMwk / Math.max(1, monetizationConfig.minWithdrawalMwk)) * 100)
  );

  const numericAmount = Number(amountInput) || 0;
  const estimatedFeeMwk = Math.round((numericAmount * monetizationConfig.payoutFeePercent) / 100);
  const estimatedNetMwk = Math.max(0, numericAmount - estimatedFeeMwk);

  const handleVerifySignature = async (key: string, signature: string, label: string) => {
    setVerifyingId(key);
    try {
      const res = await verifyServerToken(signature);
      setVerifiedResults((prev) => ({ ...prev, [key]: Boolean(res.valid) }));
      if (res.valid) {
        onShowNotice(
          isNy
            ? `${label} yatsimikizika bwino ndi seva.`
            : `${label} signature verified cryptographically by server.`
        );
      } else {
        onShowNotice(
          res.error || (isNy ? `${label} yalephera kutsimikizika.` : `${label} verification failed.`),
          'err'
        );
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onRequireReauth(
      isNy
        ? 'Tsimikizani kuti ndi inu musanawonjezere njira yolandirira ndalama.'
        : 'Confirm it is you before adding a payout method.'
    );
    if (!ok) return;
    setIsAddingPm(true);
    const res = await onAddPayoutMethod({
      type: pmType,
      identifier: pmIdentifier,
      accountHolderName: pmHolderName,
      artistId: currentArtist?.id,
    });
    setIsAddingPm(false);
    if (res.success) {
      setPmIdentifier('');
      setShowAddMethod(false);
      onShowNotice(
        isNy ? 'Njira yolandirira ndalama yawonjezedwa ndi kutsimikizika.' : 'Payout method added and verified.'
      );
    } else {
      onShowNotice(
        res.error || (isNy ? 'Sitinathe kuwonjezera njira yolandirira ndalama.' : 'Could not add payout method.'),
        'err'
      );
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentArtist) return;

    if (!isMonetized) {
      onShowNotice(
        isNy
          ? 'Malipiro ayenera kuvomerezedwa musanatenge ndalama.'
          : 'Monetization must be approved before submitting withdrawals.',
        'err'
      );
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount < monetizationConfig.minWithdrawalMwk) {
      onShowNotice(
        isNy
          ? `Ndalama zochepera zomwe mungatenge ndi ${monetizationConfig.minWithdrawalMwk.toLocaleString()} MWK.`
          : `Minimum withdrawal is ${monetizationConfig.minWithdrawalMwk.toLocaleString()} MWK.`,
        'err'
      );
      return;
    }
    if (numericAmount > availableBalanceMwk) {
      onShowNotice(
        isNy ? 'Ndalama zomwe mwalemba zaposa zomwe zilipo.' : 'Requested amount exceeds your available balance.',
        'err'
      );
      return;
    }
    if (!activeMethodId) {
      onShowNotice(isNy ? 'Ikani kaye njira yolandirira ndalama.' : 'Add a payout method first.', 'err');
      return;
    }

    const ok = await onRequireReauth(
      isNy
        ? 'Tsimikizani kuti ndi inu musanapange chizindikiro cha malipiro.'
        : 'Confirm your identity before generating a payout token.'
    );
    if (!ok) return;

    setIsSubmitting(true);
    const res = await onSubmitWithdrawal({
      artistId: currentArtist.id,
      artistName: currentArtist.name,
      payoutMethodId: activeMethodId,
      grossAmountMwk: numericAmount,
    });
    setIsSubmitting(false);

    if (res.success) {
      setAmountInput('');
      if (res.request) setLatestIssuedRequest(res.request);
      const tok = res.request?.payoutToken ? ` · ${isNy ? 'Chizindikiro' : 'Token'} ${res.request.payoutToken}` : '';
      onShowNotice(
        res.request?.settlementVerified
          ? isNy
            ? `Malipiro atumizidwa${tok}`
            : `Withdrawal dispatched${tok}`
          : isNy
          ? `Chizindikiro cha malipiro chapangidwa${tok}`
          : `Withdrawal token generated & queued${tok}`
      );
    } else {
      onShowNotice(res.error || (isNy ? 'Sitinathe kukonza pempholi.' : 'Could not process withdrawal.'), 'err');
    }
  };

  const renderStatusPill = (status: PayoutRequest['status']) => {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/35">
          <CheckCircle2 className="w-3 h-3" />
          <span>{isNy ? 'Zaperekedwa' : 'Paid'}</span>
        </span>
      );
    }
    if (status === 'processing') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--violet)]/15 text-[var(--violet)] border border-[var(--violet)]/35">
          <RefreshCw className="w-3 h-3" />
          <span>{isNy ? 'Zikukonzedwa' : 'Processing'}</span>
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/35">
          <XCircle className="w-3 h-3" />
          <span>{isNy ? 'Zalephera' : 'Failed'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/35">
        <Clock className="w-3 h-3" />
        <span>{isNy ? 'Zikudikira kuyang\'aniridwa' : 'Awaiting review'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--text)] font-heading flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[var(--accent-text)]" />
            <span>{isNy ? 'Kutenga Ndalama & Mbiri ya Malipiro' : 'Withdrawals & Settlement Ledger'}</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {isNy
              ? 'Onani ndalama za MWK zomwe zilipo, tsimikizirani zizindikiro za malipiro, ndipo onani malipiro apitawo.'
              : 'Track your withdrawable MWK balance, verify server payout tokens, and inspect processed payment history.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefreshEarnings}
          disabled={isRefreshingEarnings}
          className="px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEarnings ? 'animate-spin' : ''}`} />
          <span>{isNy ? 'Tsitsimutsa ndalama' : 'Refresh balance'}</span>
        </button>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-5 rounded-[22px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <div className="text-xs text-[var(--text-muted)]">
            {isNy ? 'Ndalama zotenga' : 'Available balance'}
          </div>
          <div className="text-2xl font-extrabold font-heading text-[var(--accent-text)] tabular-nums">
            <CountUpValue value={availableBalanceMwk} suffix=" MWK" replayKey={earningsRefreshKey} />
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono">
            {isNy ? 'Zopeza zonse:' : 'Lifetime earned:'} {computedEarningsMwk.toLocaleString()} MWK
          </div>
        </div>

        <div className="p-5 rounded-[22px] bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
          <div className="text-xs text-[var(--text-muted)]">
            {isNy ? 'Mkhalidwe wotenga' : 'Withdrawal status'}
          </div>
          <div className="text-sm font-extrabold text-[var(--text)] flex items-center gap-1.5">
            {isMonetized ? (
              <ShieldCheck className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            )}
            <span>{withdrawalStatusLabel}</span>
          </div>
          {currentArtist?.monetizationApprovalToken ? (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--accent)]/40 text-[10px] font-mono text-[var(--accent-text)]">
                {currentArtist.monetizationApprovalToken}
              </span>
              {currentArtist.monetizationTokenSignature && (
                <button
                  type="button"
                  disabled={verifyingId === 'approval'}
                  onClick={() =>
                    handleVerifySignature(
                      'approval',
                      currentArtist.monetizationTokenSignature!,
                      isNy ? 'Chizindikiro chovomerezeka' : 'Approval token'
                    )
                  }
                  className="text-[10px] font-semibold text-[var(--violet)] underline cursor-pointer disabled:opacity-50"
                >
                  {verifyingId === 'approval'
                    ? isNy
                      ? 'Ikufufuza...'
                      : 'Checking...'
                    : verifiedResults.approval === true
                    ? isNy
                      ? 'Chotsimikizika ✓'
                      : 'Verified ✓'
                    : isNy
                    ? 'Tsimikizirani'
                    : 'Verify'}
                </button>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-[var(--text-muted)]">
              {isNy ? 'Zochepera:' : 'Min payout:'} {monetizationConfig.minWithdrawalMwk.toLocaleString()} MWK
            </div>
          )}
        </div>

        <div className="p-5 rounded-[22px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <div className="text-xs text-[var(--text-muted)]">
            {isNy ? 'Zikudikira & kukonzedwa' : 'Pending & processing'}
          </div>
          <div className="text-2xl font-extrabold font-heading text-[var(--text)] tabular-nums">
            <CountUpValue value={summaryStats.totalPendingMwk} suffix=" MWK" replayKey={earningsRefreshKey} />
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono">
            {isNy
              ? `Mapempho ${summaryStats.pendingCount} ogwira ntchito`
              : `${summaryStats.pendingCount} active request${summaryStats.pendingCount === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="p-5 rounded-[22px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <div className="text-xs text-[var(--text-muted)]">
            {isNy ? 'Zonse zaperekedwa' : 'Total paid out'}
          </div>
          <div className="text-2xl font-extrabold font-heading text-emerald-500 tabular-nums">
            <CountUpValue value={summaryStats.totalPaidMwk} suffix=" MWK" replayKey={earningsRefreshKey} />
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono">
            {isNy
              ? `Malipiro ${summaryStats.paidCount} omaliza`
              : `${summaryStats.paidCount} completed payout${summaryStats.paidCount === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      {/* Lock Banner if Monetization is not yet active */}
      {!isMonetized && (
        <div className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-[var(--text)]">
                {allEligible
                  ? isNy
                    ? 'Zofunikira zatha — yatsani malipiro kuti mutenge ndalama'
                    : 'Eligibility goals complete — activate monetization to withdraw'
                  : isNy
                  ? 'Malipiro ayenera kutsegulidwa musanatenge ndalama'
                  : 'Monetization must be unlocked before withdrawing earnings'}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {isNy
                  ? 'Malizitsani mndandanda wa malipiro kuti seva ikupatseni chizindikiro chotsegulira ndalama.'
                  : 'Complete your Monetization checklist so the backend can issue your cryptographic approval token and enable withdrawals.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenMonetizationTab}
            className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer shrink-0 self-start sm:self-auto"
          >
            {isNy ? 'Pitani ku Malipiro' : 'Go to Monetization'}
          </button>
        </div>
      )}

      {/* Withdrawal Request Form + Payout Account Readiness */}
      {isMonetized && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 p-5 sm:p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{isNy ? 'Pemphani kutenga ndalama' : 'Request withdrawal'}</span>
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {minThresholdPct}% {isNy ? 'pa' : 'of'} {monetizationConfig.minWithdrawalMwk.toLocaleString()} MWK {isNy ? 'zochepera' : 'min'}
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${minThresholdPct}%` }}
              />
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--text)]">
                    {isNy ? 'Njira yolandirira ndalama' : 'Destination payout method'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddMethod((prev) => !prev)}
                    className="text-[11px] font-bold text-[var(--accent-text)] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>
                      {showAddMethod
                        ? isNy
                          ? 'Lekani'
                          : 'Cancel'
                        : isNy
                        ? 'Ikani njira ina'
                        : 'Add new method'}
                    </span>
                  </button>
                </div>

                {payoutMethods.length > 0 ? (
                  <select
                    value={activeMethodId}
                    onChange={(e) => setSelectedMethodId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  >
                    {payoutMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} · {m.maskedIdentifier} ({m.accountHolderName})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      {isNy
                        ? 'Palibe njira yosungidwa. Ikani Airtel Money, Mpamba kapena USDT kuti mutenge ndalama.'
                        : 'No payout method saved yet. Add Airtel Money, Mpamba, or USDT to withdraw.'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[var(--text)]">
                    {isNy ? 'Ndalama (MWK)' : 'Amount (MWK)'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: '25%', factor: 0.25 },
                      { label: '50%', factor: 0.5 },
                      { label: isNy ? 'Zonse' : 'Max', factor: 1 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={availableBalanceMwk <= 0}
                        onClick={() =>
                          setAmountInput(String(Math.floor(availableBalanceMwk * preset.factor)))
                        }
                        className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-[10px] font-mono font-bold text-[var(--text)] cursor-pointer disabled:opacity-40"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="number"
                  min={monetizationConfig.minWithdrawalMwk}
                  step={500}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder={
                    isNy
                      ? `Lembani MWK (zochepera ${monetizationConfig.minWithdrawalMwk.toLocaleString()})`
                      : `Enter MWK (min ${monetizationConfig.minWithdrawalMwk.toLocaleString()})`
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                />
              </div>

              {numericAmount > 0 && (
                <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-1.5">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>
                      {isNy ? 'Chindapusa cha pulogalamu' : 'Platform fee'} ({monetizationConfig.payoutFeePercent}%)
                    </span>
                    <span className="font-mono tabular-nums">{estimatedFeeMwk.toLocaleString()} MWK</span>
                  </div>
                  <div className="flex justify-between font-bold text-[var(--text)]">
                    <span>{isNy ? 'Ndalama zomwe mulandire' : 'Estimated net payout'}</span>
                    <span className="font-mono tabular-nums text-[var(--accent-text)]">
                      {estimatedNetMwk.toLocaleString()} MWK
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || payoutMethods.length === 0 || availableBalanceMwk < monetizationConfig.minWithdrawalMwk}
                className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting
                  ? isNy
                    ? 'Ikupanga chizindikiro cha malipiro...'
                    : 'Generating signed payout token...'
                  : isNy
                  ? 'Pangani Chizindikiro & Tengani Ndalama'
                  : 'Generate Payout Token & Withdraw'}
              </button>
            </form>

            {latestIssuedRequest?.payoutToken && (
              <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--accent)]/45 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--accent-text)] flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4" />
                    <span>{isNy ? 'Chizindikiro cha Seva Chapangidwa' : 'Backend Payout Token Issued'}</span>
                  </span>
                  {renderStatusPill(latestIssuedRequest.status)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block text-[10px]">
                      {isNy ? 'Chizindikiro cha Malipiro' : 'Payout Token'}
                    </span>
                    <span className="font-bold text-[var(--text)]">{latestIssuedRequest.payoutToken}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block text-[10px]">
                      {isNy ? 'Nambala ya Malipiro' : 'Transaction Ref'}
                    </span>
                    <span className="font-bold text-[var(--text)]">
                      {latestIssuedRequest.txRef || (isNy ? 'Ikudikira' : 'Pending')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Payout Accounts & Inline Add Form */}
          <div className="lg:col-span-2 p-5 sm:p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--violet)]" />
              <span>{isNy ? 'Maakaunti olandirira ndalama' : 'Connected payout accounts'}</span>
            </h3>

            {payoutMethods.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                {isNy
                  ? 'Sungani njira imodzi (Airtel Money, TNM Mpamba kapena USDT) kuti mulandire malipiro.'
                  : 'Save at least one payout channel (Airtel Money, TNM Mpamba, or USDT) to receive payouts.'}
              </p>
            ) : (
              <div className="space-y-2">
                {payoutMethods.map((pm) => {
                  const accepted =
                    pm.status === 'accepted' || new Date(pm.payoutHoldUntil).getTime() <= Date.now();
                  return (
                    <div
                      key={pm.id}
                      className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--text)]">
                        <span>{pm.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] border ${
                            accepted
                              ? 'border-[var(--accent)]/40 text-[var(--accent-text)]'
                              : 'border-[var(--border)] text-amber-500'
                          }`}
                        >
                          {accepted
                            ? isNy
                              ? 'Yavomerezedwa'
                              : 'Accepted'
                            : isNy
                            ? 'Ikudikira chitetezo'
                            : 'Pending hold'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)]">
                        {pm.maskedIdentifier} · {pm.accountHolderName}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(showAddMethod || payoutMethods.length === 0) && (
              <form onSubmit={handleAddMethod} className="space-y-2.5 pt-3 border-t border-[var(--border)]">
                <div className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Ikani njira yolandirira ndalama' : 'Add payout method'}
                </div>
                <select
                  value={pmType}
                  onChange={(e) => setPmType(e.target.value as PayoutProviderType)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                >
                  <option value="airtel_money">Airtel Money (+265 99 / 98)</option>
                  <option value="tnm_mpamba">TNM Mpamba (+265 88 / 89)</option>
                  <option value="usdt_trc20">USDT (TRON / TRC-20)</option>
                  <option value="usdt_bep20">USDT (BNB Smart Chain / BEP-20)</option>
                </select>
                <input
                  type="text"
                  required
                  value={pmIdentifier}
                  onChange={(e) => setPmIdentifier(e.target.value)}
                  placeholder={
                    pmType === 'airtel_money'
                      ? '+265991234567'
                      : pmType === 'tnm_mpamba'
                      ? '+265881234567'
                      : pmType === 'usdt_trc20'
                      ? 'T... (34 chars)'
                      : '0x... (42 chars)'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                />
                <input
                  type="text"
                  required
                  value={pmHolderName}
                  onChange={(e) => setPmHolderName(e.target.value)}
                  placeholder={isNy ? 'Dzina lonse la mwini akaunti' : 'Account holder full name'}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                />
                <button
                  type="submit"
                  disabled={isAddingPm}
                  className="w-full py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text)] cursor-pointer disabled:opacity-50"
                >
                  {isAddingPm
                    ? isNy
                      ? 'Ikusunga...'
                      : 'Saving...'
                    : isNy
                    ? 'Sungani njira'
                    : 'Save payout method'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Full History of Processed & Pending Payments */}
      <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">
              {isNy ? 'Mbiri ya Malipiro & Kutenga Ndalama' : 'Payment & Withdrawal History'}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {isNy
                ? `Pempho lililonse la malipiro, chizindikiro ndi mkhalidwe wake (${payoutRequests.length} zonse)`
                : `Every payout request, server-signed token, and settlement status (${payoutRequests.length} total)`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: `${isNy ? 'Zonse' : 'All'} (${payoutRequests.length})` },
                { id: 'paid', label: `${isNy ? 'Zaperekedwa' : 'Paid'} (${summaryStats.paidCount})` },
                {
                  id: 'processing',
                  label: `${isNy ? 'Zikukonzedwa' : 'Processing'} (${payoutRequests.filter((r) => r.status === 'processing').length})`,
                },
                {
                  id: 'awaiting_review',
                  label: `${isNy ? 'Zikuyang\'aniridwa' : 'In Review'} (${payoutRequests.filter((r) => r.status === 'awaiting_review').length})`,
                },
                {
                  id: 'failed',
                  label: `${isNy ? 'Zalephera' : 'Failed'} (${payoutRequests.filter((r) => r.status === 'failed').length})`,
                },
              ] as { id: HistoryFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setHistoryFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition ${
                  historyFilter === f.id
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Wallet className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
            <div className="text-sm font-bold text-[var(--text)]">
              {payoutRequests.length === 0
                ? isNy
                  ? 'Palibe pempho lotenga ndalama pakadali pano'
                  : 'No withdrawals requested yet'
                : isNy
                ? 'Palibe malipiro ofanana ndi kusankha kwanu'
                : 'No withdrawals match this filter'}
            </div>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              {isNy
                ? 'Mukapempha kutenga ndalama, chizindikiro cha seva, nambala ndi mkhalidwe zionekera pano.'
                : 'Once you submit a withdrawal request, its backend settlement token, transaction reference, and payout status appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[var(--surface-2)]/35 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold font-mono text-[var(--text)] tabular-nums">
                      {req.netAmountMwk.toLocaleString()} MWK
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      ({isNy ? 'Zonse' : 'Gross'} {req.grossAmountMwk.toLocaleString()} ·{' '}
                      {isNy ? 'Chindapusa' : 'Fee'} {req.feeMwk.toLocaleString()})
                    </span>
                    {renderStatusPill(req.status)}
                    {req.settlementVerified && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--surface-2)] border border-[var(--accent)]/40 text-[var(--accent-text)]">
                        {isNy ? 'Zatsimikizika' : 'Settlement verified'}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[var(--text-muted)] flex items-center flex-wrap gap-x-2 gap-y-1">
                    <span className="font-semibold text-[var(--text)]">{req.payoutMethodLabel}</span>
                    <span>·</span>
                    <span className="font-mono">{req.payoutDestinationMasked}</span>
                    <span>·</span>
                    <span className="font-mono">
                      {isNy ? 'Zinapemphedwa' : 'Requested'} {new Date(req.requestedAt).toLocaleString()}
                    </span>
                    {req.processedAt && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-emerald-500">
                          {isNy ? 'Zinakonzwa' : 'Processed'} {new Date(req.processedAt).toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>

                  {(req.payoutToken || req.txRef || req.failureReason) && (
                    <div className="flex items-center flex-wrap gap-2 pt-0.5 text-[10px] font-mono">
                      {req.payoutToken && (
                        <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--accent-text)] font-bold">
                          {req.payoutToken}
                        </span>
                      )}
                      {req.txRef && (
                        <span className="text-[var(--text-muted)]">
                          {isNy ? 'Nambala:' : 'Ref:'} {req.txRef}
                        </span>
                      )}
                      {req.failureReason && (
                        <span className="text-[var(--danger)]">{req.failureReason}</span>
                      )}
                    </div>
                  )}
                </div>

                {req.payoutTokenSignature && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={verifyingId === req.id}
                      onClick={() =>
                        handleVerifySignature(
                          req.id,
                          req.payoutTokenSignature!,
                          req.payoutToken || (isNy ? 'Chizindikiro' : 'Settlement token')
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--violet)] text-xs font-semibold text-[var(--violet)] cursor-pointer disabled:opacity-50"
                    >
                      {verifyingId === req.id
                        ? isNy
                          ? 'Ikutsimikiza...'
                          : 'Verifying...'
                        : verifiedResults[req.id] === true
                        ? isNy
                          ? 'Yatsimikizika ✓'
                          : 'Token Verified ✓'
                        : isNy
                        ? 'Tsimikizani Chizindikiro'
                        : 'Verify Token'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
