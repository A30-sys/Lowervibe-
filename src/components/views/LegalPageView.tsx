import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copyright,
  FileText,
  Lock,
  Mail,
  Music2,
  Send,
  Shield,
} from 'lucide-react';
import React, { useState } from 'react';
import { LEGAL_CONFIG } from '../../config/legalConfig';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';

interface LegalPageViewProps {
  docType: 'terms' | 'privacy' | 'copyright' | 'about';
}

interface SectionBlock {
  id: string;
  title: string;
  body: React.ReactNode;
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({ docType }) => {
  const { goBack, navigate } = useRouter();
  const { currentUser } = useAuth();
  const { submitContentReportRecord } = useAudio();
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dmcaSubmitted, setDmcaSubmitted] = useState(false);
  const [dmcaSubmitting, setDmcaSubmitting] = useState(false);
  const [claimantName, setClaimantName] = useState(currentUser?.name || '');
  const [claimantEmail, setClaimantEmail] = useState(currentUser?.email || '');
  const [workTitle, setWorkTitle] = useState('');
  const [infringingUrl, setInfringingUrl] = useState('');
  const [proofDetails, setProofDetails] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const title =
    docType === 'terms'
      ? t('footer_terms')
      : docType === 'privacy'
      ? t('footer_privacy')
      : docType === 'about'
      ? t('about_title', 'About LOWERVIBE')
      : t('footer_copyright');

  const summaryBullets =
    docType === 'terms'
      ? isNy
        ? [
            'Oimba amakhala eni ake 100% a nyimbo ndi zojambula zawo.',
            'Kwezani zokha nyimbo ndi zithunzi zomwe munapanga kapena muli ndi chilolezo chogawana.',
            'Omvera amamvera nyimbo paokha, osati kubera kapena kugawiranso mafayilo.',
            'Malipiro amawerengedwa kutengera kumvera kwenikweni kosati nambala zabodza.',
            'Malamulowa amatsatira malamulo a dziko la Republic of Malawi.',
          ]
        : [
            'Artists keep 100% ownership of their recordings and songs.',
            'You only upload music and cover art you made or have clear rights to share.',
            'Listeners stream music for personal enjoyment, not to rip or redistribute files.',
            'Payouts, where active, are calculated from verified real plays and never fake numbers.',
            'These terms are governed by the laws of the Republic of Malawi.',
          ]
      : docType === 'privacy'
      ? isNy
        ? [
            'Timatenga zofunikira zokha zothandiza kuti LOWERVIBE igwire ntchito: akaunti, mindandanda, zokondedwa ndi mbiri yakale.',
            'Sitigulitsa mbiri yanu kapena manambala anu ku makampani otsatsa malonda.',
            'Nyimbo zotsitsidwa popanda intaneti zimasungidwa pa chipangizo chanu ndipo mungathe kuzichotsa nthawi iliyonse.',
            'Mutha kutsitsa deta yanu yonse kapena kufufuta akaunti yanu mu Zokonda za Mbiri Yanu.',
            'Zimatetezedwa motsatira malamulo a chinsinsi a ku Malawi ndi mayiko ena.',
          ]
        : [
            'We collect only what makes LOWERVIBE work: your account, playlists, likes, and play history.',
            'We do not sell your listening history or personal contact details to ad networks.',
            'Offline saved tracks live locally in your browser storage so you can clear them anytime.',
            'You can download a full JSON copy of your account data or delete your account inside Profile Settings.',
            'Protected under our data practices aligned with Malawi Electronic Transactions & Cyber Security law and international privacy standards.',
          ]
      : isNy
      ? [
          'Kwezani zokha nyimbo ndi chithunzi chomwe munapanga kapena muli ndi chilolezo.',
          'Ngati nyimbo yanu yakwezedwa popanda chilolezo, tumizani pempho loichotsa pansipa.',
          'Timayang\'anira madandaulo enieni mwachangu ndi kuchotsa nyimbo zobera.',
          'Kuphwanya ufulu wa nyimbo mobwerezabwereza kumabweretsa kutsekedwa kwa akaunti.',
          `Mauthenga azamalamulo angatumizidwenso ku ${LEGAL_CONFIG.copyrightEmail}.`,
        ]
      : [
          'Only upload audio and square artwork you created or are licensed to publish.',
          'If your music was uploaded without permission, file a takedown notice below.',
          'We review valid copyright reports promptly and take down infringing tracks when verified.',
          'Repeated verified copyright violations lead to permanent account suspension.',
          `Direct legal notices can also be sent to ${LEGAL_CONFIG.copyrightEmail}.`,
        ];

  const finalSummaryBullets =
    docType === 'about'
      ? isNy
        ? [
            'LOWERVIBE ndi malo omvera nyimbo za oimba odziyimira okha a ku Malawi ndi mu Africa monse.',
            'Oimba amasunga ufulu wawo 100% wa nyimbo zawo ndi kupeza chiwerengero chenicheni cha omvera.',
            'Omvera amamvera nyimbo mwachangu, kusunga nyimbo popanda intaneti, ndi kupanga mindandanda.',
            'Tikukhazikika ku Nsanje, M1 Road, Malawi, ndipo timalankhulana mwachindunji kudzera pa odulamw@gmail.com.',
          ]
        : [
            'LOWERVIBE is an independent African music streaming platform rooted in Malawi and built for creators across Africa.',
            'Artists keep 100% ownership of their masters while tracking real, verified plays and fan engagement.',
            'Listeners stream smoothly even on low-end mobile devices, build personal playlists, and save eligible tracks offline.',
            `Headquartered at ${LEGAL_CONFIG.physicalAddress} with direct support at ${LEGAL_CONFIG.supportEmail}.`,
          ]
      : summaryBullets;

  const termsSections: SectionBlock[] = [
    {
      id: 'who-we-are',
      title: '1. Who runs LOWERVIBE',
      body: (
        <div className="space-y-2">
          <p>
            LOWERVIBE is an independent music streaming platform connecting listeners and creators across Malawi,
            Nigeria, and wider Africa. Questions about these terms can be sent to{' '}
            <a href={`mailto:${LEGAL_CONFIG.legalEmail}`} className="underline text-[var(--accent-text)]">
              {LEGAL_CONFIG.legalEmail}
            </a>
            .
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            <strong className="text-[var(--text)]">Registered Office:</strong> {LEGAL_CONFIG.physicalAddress}
          </p>
        </div>
      ),
    },
    {
      id: 'accounts',
      title: '2. Your account & safety',
      body: (
        <ul className="list-disc pl-5 space-y-2">
          <li>You must provide accurate sign-in details and keep your password or phone OTP private.</li>
          <li>You are responsible for activity under your account.</li>
          <li>You must be at least 13 years old (or the minimum legal age in your country) to create an account.</li>
        </ul>
      ),
    },
    {
      id: 'artist-rights',
      title: '3. Music ownership & non-exclusive license',
      body: (
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>You keep your rights:</strong> Uploading music to LOWERVIBE does not transfer copyright or master
            ownership to us. You remain 100% owner of your recordings and compositions.
          </li>
          <li>
            <strong>Permission to stream:</strong> You grant LOWERVIBE a non-exclusive, worldwide, royalty-free
            permission solely to store, stream, display cover art, and promote your uploaded tracks inside the app
            until you remove them.
          </li>
          <li>
            <strong>Originality guarantee:</strong> You promise you own or hold valid written clearance for every beat,
            vocal, sample, and cover image you upload. Do not upload promotional banners with other platform logos.
          </li>
        </ul>
      ),
    },
    {
      id: 'acceptable-use',
      title: '4. Respectful use & zero fake plays',
      body: (
        <ul className="list-disc pl-5 space-y-2">
          <li>No bots, scripts, stream-farming loops, or artificial inflation of plays, likes, or followers.</li>
          <li>No hate speech, harassment, spam, or impersonation of another artist.</li>
          <li>Accounts caught manipulating plays or uploading stolen content risk suspension and forfeited balances.</li>
        </ul>
      ),
    },
    {
      id: 'monetization',
      title: '5. Creator monetization & payouts',
      body: (
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Creator monetization is unlocked only after an artist meets clear, visible eligibility requirements in Studio
            and is approved by platform administration.
          </li>
          <li>
            Qualifying plays require real listener playback (30+ seconds, deduplicated within 30-minute windows,
            excluding self-plays by the track creator).
          </li>
          <li>
            Withdrawals require a verified payout method (Airtel Money, TNM Mpamba, or USDT wallet), pass a 24-hour
            hold when a payout method is added or edited, and meet the minimum payout threshold shown in Studio.
          </li>
        </ul>
      ),
    },
    {
      id: 'law',
      title: '6. Governing law & updates',
      body: (
        <p>
          These terms are governed by the laws of the {LEGAL_CONFIG.jurisdiction}. When we make meaningful updates to
          these terms, we update the date at the top of this page and ask active accounts to confirm before continuing.
        </p>
      ),
    },
  ];

  const privacySections: SectionBlock[] = [
    {
      id: 'data-collected',
      title: '1. Information we collect',
      body: (
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Account details:</strong> Display name, @username, email address or phone number, country, and
            profile photo you choose to provide.
          </li>
          <li>
            <strong>Music activity:</strong> Tracks you play, listening duration (for resume and real artist counts),
            likes, follows, playlists, and artist applications.
          </li>
          <li>
            <strong>Creator details:</strong> Audio and cover files you upload, and masked payout method identifiers if
            you enroll in Creator Monetization.
          </li>
        </ul>
      ),
    },
    {
      id: 'how-we-use',
      title: '2. How we use your data',
      body: (
        <ul className="list-disc pl-5 space-y-2">
          <li>To play music smoothly, save offline tracks in your browser, and remember your player settings.</li>
          <li>To compute real, accurate play counts and chart positions for independent artists.</li>
          <li>To protect accounts against unauthorized logins, abuse, and duplicate stream farming.</li>
          <li>We never sell your email, phone number, or listening history to third-party advertisers.</li>
        </ul>
      ),
    },
    {
      id: 'storage-cookies',
      title: '3. Local storage & cookies',
      body: (
        <p>
          LOWERVIBE uses browser storage and IndexedDB only to keep you signed in, remember your Light/Dark theme,
          equalizer settings, and store tracks you explicitly save for offline listening.
        </p>
      ),
    },
    {
      id: 'your-rights',
      title: '4. Your privacy rights & data controls',
      body: (
        <div className="space-y-3">
          <p>
            You can inspect, export, or delete your personal data directly inside your account without waiting for a
            support ticket:
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/account#privacy-data')}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--accent)] transition cursor-pointer"
            >
              {isNy ? 'Tsitsani deta yanga' : 'Download my data'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/account#danger-zone')}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10 transition cursor-pointer"
            >
              {isNy ? 'Fufutani akaunti yanga' : 'Delete my account'}
            </button>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Need help with a privacy request? Email{' '}
            <a href={`mailto:${LEGAL_CONFIG.privacyEmail}`} className="underline text-[var(--accent-text)]">
              {LEGAL_CONFIG.privacyEmail}
            </a>
            .
          </p>
        </div>
      ),
    },
  ];

  const copyrightSections: SectionBlock[] = [
    {
      id: 'policy',
      title: '1. Respecting creators & copyright',
      body: (
        <p>
          LOWERVIBE respects the rights of musicians, producers, photographers, and songwriters. Artists must only
          upload original recordings or tracks where every sample, beat, and artwork element is properly cleared.
        </p>
      ),
    },
    {
      id: 'strike-policy',
      title: '2. Repeat infringement policy',
      body: (
        <p>
          When a valid copyright takedown report is verified, the reported track is removed immediately and the
          uploader receives a copyright strike. Accounts with active copyright strikes are disqualified from creator
          monetization and repeated violations lead to permanent account termination.
        </p>
      ),
    },
    {
      id: 'takedown-form',
      title: '3. Submit a copyright takedown request',
      body: (
        <div className="pt-1">
          {dmcaSubmitted ? (
            <div className="p-5 rounded-2xl border border-[var(--accent)]/40 bg-[var(--surface-2)] space-y-2">
              <div className="flex items-center gap-2 font-bold text-[var(--accent-text)]">
                <CheckCircle2 className="w-5 h-5" />
                <span>{isNy ? 'Pempho lochotsa nyimbo lalandiridwa' : 'Takedown notice received'}</span>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {isNy
                  ? 'Dandaulo lanu la ufulu wa nyimbo lalemba kuti liyang\'aniridwe ndi gulu la LOWERVIBE. Tidzayankha ku '
                  : 'Your copyright claim has been logged for review by LOWERVIBE moderation. Our legal team will follow up at '}
                <strong>{claimantEmail}</strong>.
              </p>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!claimantName.trim() || !claimantEmail.trim() || !workTitle.trim() || !infringingUrl.trim()) {
                  showToast(
                    isNy ? 'Chonde lembani madera onse ofunikira' : 'Please fill in all required takedown fields'
                  );
                  return;
                }
                if (!goodFaith) {
                  showToast(
                    isNy
                      ? 'Chonde tsimikizirani kuti ndinu mwini wake wa nyimboyi'
                      : 'Please confirm the good-faith rights statement'
                  );
                  return;
                }
                setDmcaSubmitting(true);
                const res = await submitContentReportRecord({
                  type: 'copyright_dmca',
                  trackTitle: workTitle.trim(),
                  reason: `Copyright takedown by ${claimantName.trim()} (${claimantEmail.trim()})`,
                  details: proofDetails.trim(),
                  evidenceUrl: infringingUrl.trim(),
                });
                setDmcaSubmitting(false);
                if (res.success) {
                  setDmcaSubmitted(true);
                  showToast(isNy ? 'Pempho lochotsa nyimbo latumizidwa' : 'Copyright takedown request submitted');
                } else {
                  showToast(
                    res.error || (isNy ? 'Sitinathe kutumiza pempho lochotsa nyimbo' : 'Could not submit copyright takedown request')
                  );
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Your full legal name *</label>
                  <input
                    type="text"
                    required
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    placeholder="Full name or rights holder"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Contact email *</label>
                  <input
                    type="email"
                    required
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">
                  Title of your copyrighted track or work *
                </label>
                <input
                  type="text"
                  required
                  value={workTitle}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  placeholder="Exact track name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">
                  Link or track ID on LOWERVIBE *
                </label>
                <input
                  type="text"
                  required
                  value={infringingUrl}
                  onChange={(e) => setInfringingUrl(e.target.value)}
                  placeholder="https://.../tracks/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">
                  Proof of ownership / details
                </label>
                <textarea
                  rows={3}
                  value={proofDetails}
                  onChange={(e) => setProofDetails(e.target.value)}
                  placeholder="Link to original release, ISRC, or brief explanation"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <label className="flex items-start gap-2.5 text-sm text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={goodFaith}
                  onChange={(e) => setGoodFaith(e.target.checked)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  I confirm in good faith that I own these rights or am authorized to act for the owner, and that this
                  notice is accurate.
                </span>
              </label>

              <button
                type="submit"
                disabled={dmcaSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center gap-2 hover:brightness-95 transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{dmcaSubmitting ? 'Submitting...' : 'Submit takedown notice'}</span>
              </button>
            </form>
          )}
        </div>
      ),
    },
  ];

  const aboutSections: SectionBlock[] = [
    {
      id: 'about-mission',
      title: isNy ? '1. Cholinga cha LOWERVIBE' : '1. Our mission',
      body: (
        <div className="space-y-3">
          <p>
            {isNy
              ? 'LOWERVIBE idapangidwa kuti oimba a ku Malawi ndi mayiko ena aku Africa akhale ndi malo olemekezeka ofalitsira nyimbo zawo, popanda malonda abodza kapena chiwerengero chonyenga.'
              : 'LOWERVIBE gives independent musicians across Malawi and Africa a dependable streaming home without inflated vanity numbers or cluttered ad feeds.'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer min-h-[40px]"
            >
              {isNy ? 'Onani Nyimbo' : 'Explore Music'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/artistcreator')}
              className="px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] text-xs font-semibold cursor-pointer min-h-[40px]"
            >
              {t('artist_creator', 'Artist Creator')}
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'about-trust',
      title: isNy ? '2. Zowerengeka zenizeni ndi chinsinsi' : '2. Real data & transparent creator standards',
      body: (
        <p>
          {isNy
            ? 'Chiwerengero cha omvera, otsatira, ndi zokondedwa pa LOWERVIBE chimachokera ku zochita zenizeni za anthu pa nsanja yathu. Oimba amasunga ufulu wawo wonse ndipo ndemanga zimayang\'aniridwa kuti malo akhale abwino.'
            : 'Every play count, favorite, and follower count on LOWERVIBE reflects verified platform activity. Artists retain full master ownership and clear upload moderation feedback.'}
        </p>
      ),
    },
    {
      id: 'about-contact',
      title: isNy ? '3. Kulumikizana nafe' : '3. Direct support & office',
      body: (
        <div className="space-y-2">
          <p>
            <strong>{LEGAL_CONFIG.operatorName}</strong>
          </p>
          <p>{LEGAL_CONFIG.physicalAddress}</p>
          <p>
            Email:{' '}
            <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="underline text-[var(--accent-text)]">
              {LEGAL_CONFIG.supportEmail}
            </a>
          </p>
        </div>
      ),
    },
  ];

  const activeSections =
    docType === 'terms'
      ? termsSections
      : docType === 'privacy'
      ? privacySections
      : docType === 'about'
      ? aboutSections
      : copyrightSections;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-20">
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-30 h-14 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-[740px] mx-auto h-full px-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)] hover:text-[var(--accent-text)] transition cursor-pointer min-h-[44px] pr-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back')}</span>
          </button>

          <span className="text-sm font-bold text-[var(--text)] truncate">{title}</span>

          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => navigate('/about')}
              className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer ${
                docType === 'about'
                  ? 'bg-[var(--surface-2)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {isNy ? 'Zambiri' : 'About'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer ${
                docType === 'terms'
                  ? 'bg-[var(--surface-2)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {isNy ? 'Malamulo' : 'Terms'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer ${
                docType === 'privacy'
                  ? 'bg-[var(--surface-2)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {isNy ? 'Chinsinsi' : 'Privacy'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/copyright')}
              className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer ${
                docType === 'copyright'
                  ? 'bg-[var(--surface-2)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {isNy ? 'Ufulu' : 'Copyright'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Readable Container */}
      <div className="max-w-[680px] mx-auto px-4 pt-8 space-y-8 text-[16px] leading-[1.65]">
        {/* Page Heading */}
        <div className="space-y-2 border-b border-[var(--border)] pb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-text)] uppercase tracking-wider">
            {docType === 'terms' && <FileText className="w-4 h-4" />}
            {docType === 'privacy' && <Lock className="w-4 h-4" />}
            {docType === 'copyright' && <Copyright className="w-4 h-4" />}
            {docType === 'about' && <Music2 className="w-4 h-4" />}
            <span>
              {LEGAL_CONFIG.brandName} {docType === 'about' ? (isNy ? 'Nkhani Yathu' : 'Platform') : isNy ? 'Malamulo' : 'Legal'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">{title}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {isNy ? 'Zinasinthidwa komaliza:' : 'Last updated:'} {LEGAL_CONFIG.lastUpdated} ·{' '}
            {isNy ? 'Malamulo a:' : 'Jurisdiction:'} {LEGAL_CONFIG.jurisdiction}
          </p>
        </div>

        {/* "The short version" card */}
        <section className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
            <Shield className="w-4 h-4 text-[var(--accent-text)]" />
            <span>{isNy ? 'Mwachidule' : 'The short version'}</span>
          </div>
          <ul className="space-y-2 text-[15px] text-[var(--text-muted)]">
            {finalSummaryBullets.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Table of contents anchor links */}
        <nav aria-label="Document sections" className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            {isNy ? 'Zigawo' : 'Sections'}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeSections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setCollapsed((prev) => ({ ...prev, [sec.id]: false }));
                  document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text)] hover:text-[var(--accent-text)] border border-[var(--border)] transition"
              >
                {sec.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Collapsible Sections */}
        <div className="space-y-4">
          {activeSections.map((sec) => {
            const isClosed = Boolean(collapsed[sec.id]);
            return (
              <section
                key={sec.id}
                id={sec.id}
                className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden scroll-mt-20"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(sec.id)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-[var(--surface-2)] transition"
                >
                  <h2 className="text-lg font-bold text-[var(--text)]">{sec.title}</h2>
                  {isClosed ? (
                    <ChevronDown className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
                  )}
                </button>
                {!isClosed && (
                  <div className="px-5 pb-5 pt-1 text-[15.5px] text-[var(--text-muted)] leading-[1.65] border-t border-[var(--border)]">
                    {sec.body}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Contact Footer */}
        <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[var(--text-muted)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 shrink-0" />
              <span>
                {isNy ? 'Mafunso? Lumikizanani ndi ' : 'Questions? Contact '}
                <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="underline text-[var(--text)]">
                  {LEGAL_CONFIG.supportEmail}
                </a>
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)] pl-6">
              {LEGAL_CONFIG.physicalAddress}
            </div>
          </div>
          <span className="shrink-0">
            {isNy ? 'Mtundu' : 'Version'} {LEGAL_CONFIG.currentTermsVersion}
          </span>
        </div>
      </div>
    </div>
  );
};
