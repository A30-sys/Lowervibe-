export type UserRole = 'listener' | 'artist' | 'admin';
export type VisualizerStyle = 'bars' | 'wave' | 'pulse';
export type EqPreset = 'flat' | 'bass_boost' | 'vocal' | 'treble' | 'warm_tape' | 'studio_flat' | 'deep_sub' | 'air_clarity';
export type ArtistApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface ActiveSessionRecord {
  id: string;
  deviceLabel: string;
  browser: string;
  lastActiveAt: string;
  isCurrent?: boolean;
}

export interface UserSettings {
  playback: {
    streamingQuality: 'auto' | 'high' | 'saver';
    downloadQuality: 'high' | 'saver';
    crossfadeSeconds: number;
    gapless: boolean;
    normalizeVolume: boolean;
    autoplaySimilar: boolean;
    eqPreset: 'flat' | 'bass_boost' | 'vocal' | 'treble';
    monoAudio: boolean;
    showLyrics: boolean;
  };
  dataSaver: {
    enabled: boolean;
    streamWifiOnly: boolean;
    downloadWifiOnly: boolean;
    estimatedDataUsedBytesThisMonth: number;
    dataUsageMonthKey: string;
  };
  notifications: {
    newReleasesInApp: boolean;
    newReleasesPush: boolean;
    likesFollowsInApp: boolean;
    likesFollowsPush: boolean;
    weeklyRecapInApp: boolean;
    weeklyRecapPush: boolean;
    payoutUpdatesInApp: boolean;
    payoutUpdatesPush: boolean;
    productNewsInApp: boolean;
    productNewsPush: boolean;
    promotionalBanners?: boolean;
    playlistUpdatesInApp?: boolean;
    playlistUpdatesPush?: boolean;
    soundEnabled: boolean;
  };
  privacy: {
    publicProfile: boolean;
    showListeningActivity: boolean;
    showPlaylistsPublicly: boolean;
    explicitContentFilter: boolean;
  };
  appearance: {
    theme: 'system' | 'light' | 'dark';
    language: 'en' | 'ny';
    density: 'comfortable' | 'compact';
    reducedMotion?: boolean;
  };
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  playback: {
    streamingQuality: 'auto',
    downloadQuality: 'high',
    crossfadeSeconds: 0,
    gapless: true,
    normalizeVolume: false,
    autoplaySimilar: true,
    eqPreset: 'flat',
    monoAudio: false,
    showLyrics: true,
  },
  dataSaver: {
    enabled: false,
    streamWifiOnly: false,
    downloadWifiOnly: false,
    estimatedDataUsedBytesThisMonth: 0,
    dataUsageMonthKey: new Date().toISOString().slice(0, 7),
  },
  notifications: {
    newReleasesInApp: true,
    newReleasesPush: true,
    likesFollowsInApp: true,
    likesFollowsPush: false,
    weeklyRecapInApp: true,
    weeklyRecapPush: false,
    payoutUpdatesInApp: true,
    payoutUpdatesPush: true,
    productNewsInApp: true,
    productNewsPush: true,
    promotionalBanners: true,
    playlistUpdatesInApp: true,
    playlistUpdatesPush: false,
    soundEnabled: true,
  },
  privacy: {
    publicProfile: true,
    showListeningActivity: true,
    showPlaylistsPublicly: true,
    explicitContentFilter: false,
  },
  appearance: {
    theme: 'system',
    language: 'en',
    density: 'comfortable',
    reducedMotion: false,
  },
};

export interface ArtistApplication {
  id: string;
  userId: string;
  userEmail: string;
  stageName: string;
  legalName: string;
  country: string;
  primaryGenre: string;
  bio: string;
  avatarUrl: string;
  sampleTrackTitle?: string;
  sampleTrackUrl?: string;
  rightsConfirmed: boolean;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminFeedback?: string;
}

export type PayoutProviderType = 'airtel_money' | 'tnm_mpamba' | 'usdt_trc20' | 'usdt_bep20';

export interface PayoutMethod {
  id: string;
  userId: string;
  artistId?: string;
  type: PayoutProviderType;
  label: string;
  maskedIdentifier: string; // e.g. "+265 •••• 4821" or "T9xK...7fA2"
  rawDestination?: string; // stored securely for owner-only payout fulfillment
  accountHolderName: string;
  network?: 'TRC-20' | 'BEP-20';
  isDefault: boolean;
  status?: 'accepted' | 'pending' | 'rejected';
  acceptedAt?: string;
  addedAt: string;
  payoutHoldUntil: string; // Security timestamp for audit reference
}

export interface PayoutRequest {
  id: string;
  artistId: string;
  artistName: string;
  userId: string;
  userEmail: string;
  payoutMethodId: string;
  payoutMethodLabel: string;
  payoutDestinationMasked: string;
  grossAmountMwk: number;
  feeMwk: number;
  netAmountMwk: number;
  status: 'awaiting_review' | 'processing' | 'paid' | 'failed';
  failureReason?: string;
  providerConfigured: boolean;
  requestedAt: string;
  processedAt?: string;
  txRef?: string;
  payoutToken?: string;
  payoutTokenSignature?: string;
  settlementVerified?: boolean;
}

export interface PayoutRecord {
  id: string;
  artistId: string;
  artistName: string;
  amount: number;
  streamCount: number;
  period: string;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  failureReason?: string;
  processedAt?: string;
  txRef?: string;
}

export interface MonetizationConfig {
  id?: string;
  ratePerPlayMwk: number; // Explicit configurable rate in MWK per qualifying play
  ratePerPlayUsd: number;
  minWithdrawalMwk: number; // Default 20,000 MWK
  payoutFeePercent: number; // e.g. 2.5%
  requiredPublishedTracks: number; // Default 3
  requiredPlays30d: number; // Default 500
  requiredFollowers: number; // Default 50
  maxActiveStrikes: number; // Default 0
  reapplyCooldownDays: number; // Default 14
  payoutProviderConfigured: boolean;
  updatedAt?: string;
}

export const DEFAULT_MONETIZATION_CONFIG: MonetizationConfig = {
  ratePerPlayMwk: 4.5,
  ratePerPlayUsd: 0.0025,
  minWithdrawalMwk: 20000,
  payoutFeePercent: 2.5,
  requiredPublishedTracks: 3,
  requiredPlays30d: 500,
  requiredFollowers: 50,
  maxActiveStrikes: 0,
  reapplyCooldownDays: 14,
  payoutProviderConfigured: false,
};

export interface PlatformPlaylist {
  id: string;
  title: string;
  description: string;
  coverArt: string;
  trackIds: string[];
  heroTrackId?: string;
  isFeatured: boolean;
  curatedBy: string;
  updatedAt: string;
}

export interface ArtistEvent {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  venue: string;
  city: string;
  country: string;
  date: string;
  ticketUrl?: string;
  isLiveRoom?: boolean;
}

export interface ArtistClaim {
  id: string;
  artistId: string;
  artistName: string;
  applicantUserId: string;
  applicantEmail: string;
  applicantName: string;
  legalName: string;
  identityProofRef: string;
  rightsDeclaration: boolean;
  status: 'pending' | 'approved' | 'rejected';
  adminReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  adminEmail: string;
  action: string;
  targetType: 'track' | 'artist' | 'claim' | 'payout' | 'featured_vibe' | 'system' | 'monetization';
  targetId: string;
  details: string;
  timestamp: string;
}

export interface FeaturedVibe {
  trackId: string;
  date: string;
  curatorName: string;
  curatorRole: string;
  curatorNote: string;
  quoteSnippet: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  handleUpdatedAt?: string;
  email: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  role: UserRole;
  avatar: string;
  banner?: string;
  storageAvatarPath?: string;
  storageBannerPath?: string;
  bio?: string;
  country?: string;
  city?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer_not_to_say';
  age?: number;
  language?: 'en' | 'ny';
  artistId?: string;
  isAdmin?: boolean;
  isDeactivated?: boolean;
  termsAcceptedAt?: string;
  termsVersion?: string;
  applicationStatus?: ArtistApplicationStatus;
  artistApplication?: ArtistApplication;
  onboarded?: boolean;
  hasCompletedTour?: boolean;
  preferredMoods?: string[];
  preferredGenres?: string[];
  likedTrackIds: string[];
  likedArtistIds?: string[];
  savedTrackIds?: string[];
  followingArtistIds: string[];
  playlists: Playlist[];
  sessions?: ActiveSessionRecord[];
  recentSearches?: string[];
}

export interface ArtistVerificationDetails {
  verifiedDate: string;
  idConfirmed: boolean;
  rightsConfirmed: boolean;
}

export interface Artist {
  id: string;
  slug?: string;
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  storageAvatarPath?: string;
  storageBannerPath?: string;
  bio: string;
  location: string;
  city?: string;
  country?: string;
  genres: string[];
  followersCount: number;
  likesCount?: number;
  likedByUserIds?: string[];
  monthlyListeners: number;
  socials: {
    soundcloud?: string;
    spotify?: string;
    instagram?: string;
    bandcamp?: string;
    website?: string;
    youtube?: string;
    tiktok?: string;
  };
  gearAndSetup?: string[];
  featuredTrackId?: string;
  verified: boolean;
  isVerified?: boolean;
  isCertified?: boolean;
  joinedDate: string;
  contactEmail?: string;
  verificationDetails?: ArtistVerificationDetails;
  endorsedBy?: string[];
  pressKitUrl?: string;
  // Monetization status & gating
  isMonetized?: boolean;
  monetizationStatus?: 'locked' | 'pending' | 'approved' | 'rejected' | 'suspended';
  monetizationTermsAcceptedAt?: string;
  monetizationRequestedAt?: string;
  monetizationApprovedAt?: string;
  monetizationApprovedBy?: string;
  monetizationApprovalToken?: string;
  monetizationTokenSignature?: string;
  monetizationRejectedAt?: string;
  monetizationRejectionReason?: string;
  monetizationReapplyAvailableAt?: string;
  monetizationRevokedReason?: string;
  copyrightStrikes?: number;
  earningsBalanceMwk?: number;
  pendingBalanceMwk?: number;
  lifetimeEarningsMwk?: number;
  earningsBalance?: number;
  totalStreams?: number;
  tourEvents?: ArtistEvent[];
  ownerId?: string;
  ownerUserId?: string;
  claimedByUserId?: string;
  regionStats?: Record<string, number>;
  stats?: {
    plays7d: number;
    plays30d: number;
    plays90d: number;
    saves: number;
    topCities: { city: string; count: number }[];
  };
}

export interface TrackComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRole?: UserRole;
  timestampSeconds: number;
  content: string;
  createdAt: string;
  likes: number;
  hiddenByModeration?: boolean;
  reportedCount?: number;
}

export interface TrackMetadata {
  Duration: number;
  duration?: number;
  durationFormatted?: string;
  bitrate?: string;
  sampleRate?: string;
  bitDepth?: string;
  fileSize?: string;
  audioFormat?: string;
  isrcCode?: string;
  bpm?: number;
  keySignature?: string;
  composer?: string;
  recordLabel?: string;
  checksum?: string;
  verifiedSource?: 'firebase_storage' | 'https_stream';
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  artistAvatar: string;
  coverArt: string;
  audioUrl?: string;
  storageAudioPath?: string;
  storageCoverPath?: string;
  audioChecksum?: string;
  verifiedMetadata?: boolean;
  uploadedByUserId?: string;
  artworkRightsConfirmed?: boolean;
  synthPreset: 'rainy_rhodes' | 'tape_warmth' | 'midnight_drift' | 'tokyo_dawn' | 'ambient_dusk' | 'deep_chill';
  durationSeconds: number;
  metadata?: TrackMetadata;
  genre: string;
  mood?: string;
  region?: string;
  regionStats?: Record<string, number>;
  vibeTags: string[];
  bpm: number;
  keySignature?: string;
  isExplicit?: boolean;
  plays: number;
  saves?: number;
  downloads?: number;
  likes: number;
  likedByUserIds?: string[];
  reposts: number;
  releaseDate: string;
  scheduledPublishDate?: string;
  isDraft?: boolean;
  moderationStatus?: 'draft' | 'validation' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'published';
  moderationFeedback?: string;
  isFeaturedVibe?: boolean;
  curatorNote?: string;
  allowComments?: boolean;
  isDeranked?: boolean;
  story?: string;
  downloadable?: boolean;
  isCertified?: boolean;
  isMaster24Bit?: boolean;
  waveformData?: number[];
  chartRank?: number;
  audioQuality?: string;
  isrcCode?: string;
  masteringNotes?: string;
  licenseType?: string;
  lyrics?: string;
  bitrate?: string;
  sampleRate?: string;
  bitDepth?: string;
  fileSize?: string;
  composer?: string;
  recordLabel?: string;
  audioFormat?: string;
  copyrightYear?: number;
  createdAt?: string;
  updatedAt?: string;
  comments: TrackComment[];
  reactions?: Record<string, number>;
}

export interface PlayRecord {
  id: string;
  trackId: string;
  artistId: string;
  userId: string;
  country: string;
  listenedSeconds: number;
  windowKey: number;
  isArtistSelfPlay: boolean;
  qualifiesForPayout: boolean;
  playedAt: string;
}

export interface PlayHistoryItem {
  id: string;
  trackId: string;
  track: Track;
  playedAt: string;
  listenedDurationSeconds: number;
  completed: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverArt: string;
  trackIds: string[];
  createdBy: string;
  creatorName: string;
  isPublic: boolean;
  followers: number;
  country?: string;
  region?: string;
  genre?: string;
  plays?: number;
  likes?: number;
  likedByUserIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FirestoreGenre {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  isFeatured: boolean;
  color?: string;
  icon?: string;
  playsCount?: number;
  likesCount?: number;
  topRegion?: string;
  regionCounts?: Record<string, number>;
  trendingScore?: number;
  isCustom?: boolean;
  createdBy?: string;
}

export type GenreSortMode =
  | 'genre_priority'
  | 'most_played'
  | 'newest'
  | 'bpm_asc'
  | 'bpm_desc'
  | 'title_asc'
  | 'duration_desc';

export interface FriendActivityItem {
  id: string;
  artistId: string;
  artistName: string;
  artistAvatar: string;
  artistHandle?: string;
  isVerified?: boolean;
  activityType: 'released' | 'liked' | 'curated';
  trackId: string;
  trackTitle: string;
  trackCoverArt: string;
  trackArtistName: string;
  trackDurationSeconds: number;
  trackGenre: string;
  trackBpm: number;
  isMaster24Bit?: boolean;
  timestamp: string;
  timeAgoNumber?: number;
  note?: string;
}

export interface ReportRecord {
  id: string;
  type?: 'copyright_dmca' | 'artist_report' | 'track_report' | 'bug_report' | 'comment';
  trackId: string;
  trackTitle: string;
  commentId?: string;
  artistId?: string;
  artistName?: string;
  reporterEmail: string;
  reporterName?: string;
  reporterUserId?: string;
  reason: string;
  details?: string;
  evidenceUrl?: string;
  deviceInfo?: {
    os: string;
    browser: string;
    appVersion: string;
  };
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  category: 'account' | 'playback' | 'uploads' | 'payouts' | 'other';
  message: string;
  status: 'open' | 'answered' | 'closed';
  adminReply?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminConfig {
  id: string;
  adminEmail: string;
  isInitialized: boolean;
  royaltyPerStream: number;
  maintenanceMode: boolean;
  updatedAt: string;
}

export type TrackModerationStatus =
  | 'draft'
  | 'validation'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'published';

export type NotificationType =
  | 'new_release'
  | 'artist_approved'
  | 'artist_pending'
  | 'artist_rejected'
  | 'new_follower'
  | 'playlist_update'
  | 'platform_announcement'
  | 'account_security'
  | 'upload_completed'
  | 'upload_failed'
  | 'maintenance'
  | 'new_feature'
  | 'withdrawal_status'
  | 'news'
  | 'system';

export type NotificationCategory = 'essential' | 'promotional';

export interface NotificationItem {
  id: string;
  userId: string;
  userEmail?: string;
  type: NotificationType;
  category?: NotificationCategory;
  title: string;
  message: string;
  artworkUrl?: string;
  actionLabel?: string;
  readBy: string[];
  createdAt: string;
  createdBy?: string;
  actionRoute?: string;
  payoutRequestId?: string;
  payoutStatus?: PayoutRequest['status'];
}

export interface PlatformBanner {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  artworkUrl?: string;
  actionLabel?: string;
  actionRoute?: string;
  dismissible: boolean;
  active: boolean;
  priority: number;
  audience: 'all' | 'listeners' | 'artists';
  tone?: 'light' | 'dark';
  createdAt: string;
  expiresAt?: string;
  createdBy?: string;
  retryId?: string;
}
