import { ArrowRight, CheckCircle2, Home, Music2, Wallet } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';

export const ThankYouView: React.FC = () => {
  const { navigate, searchParams } = useRouter();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const type = searchParams.get('type') || 'general';
  const refCode = searchParams.get('ref') || '';
  const itemTitle = searchParams.get('title') || '';

  const copy = (() => {
    switch (type) {
      case 'artist':
        return {
          badge: isNy ? 'Pempho Lalandilidwa' : 'Application Received',
          heading: isNy
            ? 'Zikomo polembetsa ku LOWERVIBE Artist Creator'
            : 'Thank you for applying to LOWERVIBE Artist Creator',
          body: isNy
            ? 'Zambiri za pempho lanu la woimba zasungidwa bwino. Tikuyang\'anira fomu yanu ndipo mudzalandira uthenga Situdiyo yanu ikatsegulidwa.'
            : 'Your creator profile application has been saved safely. We are reviewing your details and you will get an instant notification as soon as your artist creator workspace unlocks.',
          primaryLabel: isNy ? 'Onani Mmene Pempho Lili' : 'View Approval Status',
          primaryRoute: '/artistcreator',
        };
      case 'upload':
        return {
          badge: isNy ? 'Nyimbo Yaikidwa' : 'Release Live',
          heading: isNy
            ? itemTitle
              ? `Zikomo — “${itemTitle}” tsopano ilipo`
              : 'Zikomo — Nyimbo yanu tsopano ilipo'
            : itemTitle
              ? `Thank you — “${itemTitle}” is published`
              : 'Thank you — Your release is live',
          body: isNy
            ? 'Nyimbo yanu yaunikiridwa, kusungidwa ndi kuikidwa pa LOWERVIBE. Chiwerengero chenicheni cha omvera chiziwonjezeka mu Artist Creator.'
            : 'Your track has been validated, stored, and published to the LOWERVIBE catalog. Real plays and listener metrics update automatically in Artist Creator.',
          primaryLabel: t('go_to_studio'),
          primaryRoute: '/artistcreator',
        };
      case 'payout':
        return {
          badge: isNy ? 'Kutenga Ndalama Kwalembedwa' : 'Withdrawal Logged',
          heading: isNy
            ? 'Zikomo — Pempho lanu la malipiro lalembedwa'
            : 'Thank you — Your payout request is recorded',
          body: isNy
            ? 'Pempho lanu lotenga ndalama ndi chizindikiro cha malipiro zasungidwa. Mungathe kuona mmene zikuyendera mu Kutenga Ndalama.'
            : 'Your withdrawal request and cryptographic settlement token are recorded on your artist ledger. Track real-time status updates anytime in Withdrawals.',
          primaryLabel: isNy ? 'Tsegulani Kutenga Ndalama' : 'Open Withdrawals',
          primaryRoute: '/artistcreator?tab=withdrawals',
        };
      case 'support':
        return {
          badge: isNy ? 'Uthenga Watumizidwa' : 'Message Sent',
          heading: isNy
            ? 'Zikomo polumikizana ndi Thandizo la LOWERVIBE'
            : 'Thank you for contacting LOWERVIBE Support',
          body: isNy
            ? 'Gulu lathu lalandira uthenga wanu. Tikuyankhani kudzera pa imelo yanu kapena mu akaunti yanu.'
            : 'Our support team has received your inquiry. Expect a response at your account email or inside your Account support panel.',
          primaryLabel: isNy ? 'Bwererani ku Akaunti' : 'Back to Account',
          primaryRoute: '/account',
        };
      default:
        return {
          badge: isNy ? 'Zatsimikizidwa' : 'Confirmed',
          heading: isNy
            ? 'Zikomo pothandiza nyimbo za oimba odziyimira okha'
            : 'Thank you for supporting independent music',
          body: isNy
            ? 'Zochita zanu zamalizidwa ndi kusungidwa pa LOWERVIBE. Pitilizani kumvera nyimbo za ku Malawi, Nigeria ndi Africa yonse.'
            : 'Your action has been completed and saved on LOWERVIBE. Continue discovering artists from Malawi, Nigeria, and across Africa.',
          primaryLabel: isNy ? 'Fufuzani Nyimbo' : 'Explore Music',
          primaryRoute: '/discover',
        };
    }
  })();

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4 animate-fadeIn">
      <div className="max-w-lg w-full rounded-[28px] bg-[var(--surface)] border border-[var(--border-strong)] p-7 sm:p-9 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/35 text-[var(--accent-text)] flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--accent-text)]">
            {copy.badge}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)] tracking-tight">
            {copy.heading}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            {copy.body}
          </p>
        </div>

        {refCode && (
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]">
            {isNy ? 'Nambala yotsimikizira:' : 'Reference:'}{' '}
            <span className="text-[var(--accent-text)] font-bold">{refCode}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => navigate(copy.primaryRoute)}
            className="flex-1 py-3 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
          >
            {type === 'payout' ? (
              <Wallet className="w-4 h-4" />
            ) : (
              <Music2 className="w-4 h-4" />
            )}
            <span>{copy.primaryLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="py-3 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
          >
            <Home className="w-4 h-4" />
            <span>{t('home')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
