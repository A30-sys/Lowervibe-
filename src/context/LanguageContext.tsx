import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'ny';

export interface LanguageOption {
  code: Language;
  label: string;
  native: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ny', label: 'Chichewa', native: 'Chichewa' },
];

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Core Navigation
    home: 'Home',
    search: 'Search',
    library: 'Library',
    upload: 'Upload',
    profile: 'Profile',
    explore: 'Explore',
    trending: 'Trending',
    new_albums: 'New Releases',
    artists: 'Artists',
    history: 'History',
    playlists: 'Playlists',
    share_as_artist: 'Upload Music',
    search_placeholder: 'Search songs, artists, or playlists...',
    install_app: 'Install App',
    creator_app: 'Creator App',
    artist_creator: 'Artist Creator',
    sign_in: 'Sign in',
    create_account: 'Create account',
    all: 'All',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    saving: 'Saving...',
    back: 'Back',
    next: 'Next',
    share: 'Share',
    follow: 'Follow',
    following: 'Following',
    unfollow: 'Unfollow',
    like: 'Like',
    unlike: 'Unlike',
    download: 'Download',
    downloaded: 'Downloaded',
    play_all: 'Play all',
    see_all: 'See all',
    verified: 'Verified',
    song_singular: 'song',
    song_plural: 'songs',
    play_singular: 'play',
    play_plural: 'plays',
    like_singular: 'like',
    like_plural: 'likes',
    follower_singular: 'follower',
    follower_plural: 'followers',
    listener: 'Listener',
    artist: 'Artist',
    admin: 'Admin',

    // Header & Notifications
    notifications: 'Notifications',
    unread_count: '{count} unread',
    all_caught_up: 'All caught up',
    total_count: '{count} total',
    mark_all_read: 'Mark all read',
    enable_alerts_banner: 'Enable device sound & OS alerts for releases & admin updates',
    enable: 'Enable',
    notif_tab_all: 'All',
    notif_tab_unread: 'Unread',
    notif_tab_updates: 'Updates',
    no_unread_notifs: 'No unread notifications',
    no_updates_yet: 'No updates yet',
    no_notifs_yet: 'No notifications yet',
    no_unread_desc: 'You have read all incoming creator and account activity.',
    no_notifs_desc: 'Studio approvals, upload updates, and releases appear here.',
    open_artist_creator: 'Open Artist Creator →',
    view_artist: 'View Artist →',
    open_arrow: 'Open →',
    just_now: 'Just now',
    minutes_ago: '{count}m ago',
    hours_ago: '{count}h ago',
    active_alerts: 'Active platform alerts',
    mark_read: 'Mark read',
    listening_session_label: 'Listening wellness',
    break_prompt_title: 'Time for a short listening break',
    break_prompt_body: 'You have been listening continuously for {duration}. Rest your ears for a few minutes and grab some water when you are ready.',
    take_short_break: 'Take a break',
    continue_listening_btn: 'Keep listening',
    break_taken_toast: 'Playback paused — enjoy a short break.',

    // Home & Discovery
    music_feed_for: 'Music feed for {country}',
    liked_count_short: '{count} liked',
    following_count_short: '{count} following',
    recently_played_count_short: '{count} recently played',
    play_mix: 'Play mix',
    shuffling_tracks: 'Shuffling tracks',
    playing_top_mix: 'Playing top mix',
    resume_song: 'Resume song',
    time_left: '{time} left',
    spotlight_suffix: '{genre} spotlight',
    top_genre_playing: 'Top {genre} songs playing right now',
    public_playlists: 'Public playlists',
    public_playlists_sub: 'Listener-made collections ready to stream',
    picked_for_genres: 'Picked for your genres',
    based_on_genres: 'Based on {genres}',
    recommended_for_you: 'Recommended for you',
    recommended_for_you_sub: 'Fresh mix of real songs refreshed on every visit',
    mix_again: 'Remix',
    daily_mix: 'Daily Mix',
    daily_mix_sub: 'Built from genres you listen to',
    artists_to_follow: 'Artists to follow',
    artists_to_follow_sub: 'Independent creators releasing on LOWERVIBE',
    because_you_played: 'Because you played {title}',
    similar_genre_sound: 'Similar genre and sound',
    from_followed_artists: 'From artists you follow',
    latest_followed_sub: 'Latest songs from creators in your list',
    trending_in_country: 'Trending in {country}',
    most_played_country: 'Most played tracks from {country}',
    could_not_load_music: 'Could not load music',
    try_again: 'Try again',
    no_songs_yet: 'No songs uploaded yet',
    no_songs_yet_sub: 'Share the first track on LOWERVIBE and listeners can stream it right away.',
    upload_a_song: 'Upload a song',
    continue_listening: 'Continue listening',
    featured_releases: 'New Releases',
    all_vibes: 'All Songs',
    vibe_frequencies: 'Browse by Genre',
    vibe_subheading: 'Explore sounds across Malawi, Nigeria, and Africa',
    submit_as_artist: 'Become an Artist',

    // Categorized Releases (AllTracksSection)
    explore_by_category: 'Explore by Category',
    explore_by_category_sub: 'Browse songs grouped by sound so every genre is easy to open',
    genre_tracks_title: '{genre} tracks',
    tap_track_to_listen: 'Tap any track or category to start listening',
    tab_categories: 'Categories',
    tab_charts: 'Charts',
    tab_most_played: 'Most played',
    tab_newest: 'Newest',
    show_all_categories: 'All categories',
    nothing_matches_filter: 'Nothing matches this filter',
    try_another_filter: 'Try picking another filter or category above.',
    show_more_songs: 'Show {count} more',
    added_to_liked: 'Added to Liked songs',
    removed_from_liked: 'Removed from Liked songs',
    playing_next_toast: 'Playing "{title}" next',
    play_next: 'Play next',
    plays_count: '{count} plays',
    songs_count_label: '{count} songs',

    // Hero, New Releases, Top Ten & Vibe Trends
    featured_pick: 'Featured Pick',
    play_now: 'Play now',
    view_artist_btn: 'Artist page',
    track_details: 'Track details',
    new_releases_title: 'New Releases',
    new_releases_sub: 'Fresh songs just added to LOWERVIBE',
    top_ten_title: 'Top Charts',
    top_ten_sub: 'Most streamed songs right now',

    // Player & Fullscreen Player
    now_playing: 'Now Playing',
    play: 'Play',
    pause: 'Pause',
    previous: 'Previous',
    next_track: 'Next',
    repeat: 'Repeat',
    repeat_one: 'Repeat 1',
    repeat_all: 'Repeat all',
    shuffle: 'Shuffle',
    sleep_timer: 'Sleep Timer',
    up_next: 'Up Next',
    lyrics: 'Lyrics',
    expand_lyrics: 'Expand Lyrics',
    collapse_lyrics: 'Collapse Lyrics',
    synced_lyrics: 'Synced Lyrics',
    loading_lyrics: 'Finding synced lyrics...',
    sync_to_playing: 'Sync to current line',
    no_lyrics_yet: 'No synced lyrics available for this song yet.',
    story_behind_song: 'Story behind this song',
    audio_quality: 'Audio quality',
    equalizer: 'Equalizer',
    close_player: 'Close player',
    expand_player: 'Expand player',
    add_to_playlist: 'Add to playlist',
    queue_empty: 'Queue is empty',
    timer_off: 'Off',
    timer_minutes: '{min} min',
    timer_end_of_track: 'End of track',

    // Footer & Cookie & Mobile CTA
    footer_tagline: 'Independent music from Malawi, Nigeria, and across Africa. Built for listeners and artists everywhere.',
    footer_explore: 'Explore',
    footer_search_music: 'Search music',
    footer_your_library: 'Your Library',
    footer_artists: 'Artists',
    footer_your_profile: 'Your Profile',
    footer_legal: 'Legal',
    footer_terms: 'Terms of Service',
    footer_privacy: 'Privacy Policy',
    footer_copyright: 'Copyright & Takedown',
    footer_contact: 'Contact',
    footer_language: 'Language',
    footer_built_by: 'Built by brownjnr',
    cookie_notice: 'LOWERVIBE uses essential storage for audio playback and offline saves, plus optional analytics to improve music discovery.',
    cookie_essential: 'Essential only',
    cookie_accept_all: 'Accept all',
    sticky_cta_title: 'Join LOWERVIBE free',
    sticky_cta_sub: 'Save songs, create playlists & count real plays',

    // Install Prompt & Offline
    install_headline: 'Install LOWERVIBE on your device',
    install_body: 'Get faster access, smooth background playback, and offline listening.',
    install_creator_headline: 'Install LOWERVIBE Creator',
    install_creator_body: 'Open your Artist Studio straight from your home screen.',
    install_button: 'Install app',
    maybe_later: 'Not now',
    offline_banner: 'You are offline — downloaded songs in Library remain playable.',
    online_restored: 'Back online',

    // Share, Modals & Onboarding
    share_title: 'Share {name}',
    copy_link: 'Copy link',
    link_copied: 'Link copied!',
    share_via: 'Share via device',
    open_artist_profile: 'Open Artist Profile',
    artist_gate_title: 'Become an approved creator',
    artist_gate_body: 'Upload tracks, view analytics, and earn from real Malawi & global streams once approved.',
    apply_in_studio: 'Apply in Artist Creator',
    celebration_title: 'Welcome to LOWERVIBE Creator!',
    celebration_body: 'Your artist account {name} is approved. Open Studio to upload your first song and install the Creator app.',
    go_to_studio: 'Open Artist Creator',
    add_to_playlist_title: 'Save to playlist',
    create_playlist: 'Create new playlist',
    playlist_name_placeholder: 'Playlist name...',
    make_public: 'Public playlist',
    onboarding_title: 'Tailor your sound',
    onboarding_subtitle: 'Pick your details so LOWERVIBE recommends music you will enjoy.',
    onboarding_finish: 'Start listening',
    tour_skip: 'Skip tour',
    tour_next: 'Next',
    tour_done: 'Got it!',

    // Discover, Library, Search, Artists, Track/Artist Public Pages
    discover_title: 'Discover Music',
    discover_subtitle: 'Filter by genre, mood, country, or tempo',
    all_genres: 'All genres',
    all_moods: 'All moods',
    all_countries: 'All countries',
    sort_by: 'Sort by',
    sort_trending: 'Trending',
    sort_newest: 'Newest',
    sort_most_liked: 'Most liked',
    load_more_songs: 'Load more songs ({count} remaining)',
    loading_more_songs: 'Loading more songs...',
    library_title: 'Your Library',
    library_liked: 'Liked',
    library_offline: 'Offline',
    library_following: 'Following',
    library_playlists: 'Playlists',
    library_history: 'History',
    artists_roster_title: 'Artists on LOWERVIBE',
    artists_roster_sub: 'Independent musicians sharing original sounds',
    search_title: 'Search LOWERVIBE',
    search_empty_prompt: 'Type a song title, artist name, genre, or lyric',
    no_results_found: 'No matching results found',
    artist_songs: 'Songs',
    artist_popular: 'Popular tracks',
    artist_about: 'About',
    play_count_note_guest: 'Previewing free — sign in to save likes and count official plays.',

    // Settings & Profile
    settings: 'Settings',
    appearance: 'Appearance',
    appearance_language: 'Appearance & Language',
    language: 'Language',
    playback: 'Playback',
    data_storage: 'Data & Storage',
    privacy: 'Privacy',
    privacy_safety: 'Privacy & Safety',
    creator: 'Creator',
    creator_tools: 'Creator Tools',
    support_about: 'Support & About',
    account: 'Account',
    sign_out: 'Sign out',
    saved: 'Saved',
    edit_profile: 'Edit profile',
    close_editor: 'Close editor',
    share_profile: 'Share profile',
    view_public_profile: 'View public profile',
    browsing_as_guest: 'You are browsing as a guest',
    sign_in_profile: 'Sign in to your profile',
    guest_profile_sub: 'Save liked songs, create playlists, follow Malawian and African artists, or upload your music.',
    followers: 'Followers',
    playlists_label: 'Playlists',

    // Auth Portal
    auth_sign_in_tab: 'Sign in',
    auth_sign_up_tab: 'Create account',
    auth_continue_guest: 'Continue listening as guest',
    auth_forgot_password: 'Forgot password?',
    auth_continue_google: 'Continue with Google',
    auth_email_or_username: 'Email or @username',
    auth_password: 'Password',
    auth_remember_device: 'Keep me signed in on this device',

    // Studio / Artist Creator
    studio_signin_title: 'Sign in to open Studio',
    studio_signin_sub: 'Upload tracks, track plays, and manage earnings from one place.',
    studio_pending_badge: 'Application under review',
    studio_pending_title: 'Please wait for artist approval',
    studio_pending_sub: 'We received your creator submission. Our team reviews every artist profile to keep LOWERVIBE authentic — you will get a notification here as soon as your Studio unlocks.',
    studio_apply_title: 'Apply for Creator Studio',
    studio_reapply_title: 'Update & resubmit artist profile',
    studio_apply_sub: 'Submit your artist details for quick review and unlock music uploads.',
    studio_submit_btn: 'Submit for artist',
    studio_submitting: 'Submitting...',
    studio_tab_overview: 'Overview',
    studio_tab_upload: 'Upload',
    studio_tab_tracks: 'Tracks ({count})',
    studio_tab_analytics: 'Analytics',
    studio_tab_monetization: 'Monetization',
    studio_tab_withdrawals: 'Withdrawals',
    studio_published_songs: 'Published songs',
    studio_real_plays: 'Real plays',
    studio_track_likes: 'Track likes',
    studio_total_earnings: 'Total Earnings',
    studio_back_home: 'Back to Home',
    studio_go_profile: 'Go to Profile',

    // Major Upgrade: Search, Home, Banners, Moderation, About
    search_no_match: 'Nothing matched your search yet.',
    search_suggestions_heading: 'Try exploring these genres, artists, or popular searches',
    clear_history: 'Clear history',
    recently_played_title: 'Recently Played',
    recently_played_sub: 'Tracks from your recent listening sessions',
    trending_in_malawi: 'Trending in Malawi',
    trending_in_malawi_sub: 'Most played Malawian tracks right now',
    regional_africa_title: 'Regional African Discovery',
    regional_africa_sub: 'Fresh sounds across East, West, and Southern Africa',
    popular_music_title: 'Popular Music',
    popular_music_sub: 'Most streamed tracks across LOWERVIBE',
    featured_playlists_title: 'Featured Playlists',
    footer_about: 'About LOWERVIBE',
    about_title: 'About LOWERVIBE',
    about_subtitle: 'Independent African music streaming built for Malawian and pan-African artists and listeners.',
    banner_dismiss: 'Dismiss',
    banner_retry: 'Retry upload',
    banner_essential_badge: 'Account & Service',
    banner_promo_badge: 'Discovery',
    reduced_motion_label: 'Reduce animations',
    reduced_motion_desc: 'Minimize motion and transitions for faster performance on low-end devices',
    comments_disabled: 'Comments are turned off for this release.',
    report_comment: 'Report comment',
    delete_comment: 'Delete comment',

    // FCM Push, Audio Quality & Offline Batch Sync
    fcm_push_title: 'Lock-Screen Push Notifications (FCM)',
    fcm_push_active: 'Lock-screen alerts active',
    fcm_push_enable: 'Enable Lock-Screen Push',
    fcm_push_disable: 'Pause Push on This Device',
    fcm_push_missing_vapid: 'Set VITE_FIREBASE_VAPID_KEY to activate closed-app Web Push.',
    fcm_push_blocked: 'Notifications are blocked in your browser settings.',
    fcm_push_syncing: 'Connecting push token...',
    quality_auto_desc: 'Adapts between 96 kbps and 320 kbps',
    quality_saver_96: 'Data Saver · 96 kbps',
    quality_high_320: 'High · 320 kbps',
    data_saver_toggle: 'Mobile Data Saver (96 kbps)',
    switched_quality_toast: 'Audio quality set to {quality}',
    save_playlist_offline: 'Save playlist offline',
    sync_remaining_offline: 'Sync {count} offline',
    playlist_saved_offline: 'Saved offline',
    save_releases_offline: 'Save releases offline',
    releases_saved_offline: 'Releases saved',
    remove_offline_batch: 'Remove offline',
    syncing_offline_progress: 'Saving offline {completed}/{total}',
  },
  ny: {
    // Core Navigation (Chichewa)
    home: 'Kunyumba',
    search: 'Sakani',
    library: 'Laibulale',
    upload: 'Kwezani',
    profile: 'Mbiri Yanga',
    explore: 'Fufuzani',
    trending: 'Zotchuka',
    new_albums: 'Zatsopano',
    artists: 'Oimba',
    history: 'Mbiri Yakale',
    playlists: 'Mindandanda',
    share_as_artist: 'Kwezani Nyimbo',
    search_placeholder: 'Sakani nyimbo, oimba, kapena mindandanda...',
    install_app: 'Ikani Pulogalamu',
    creator_app: 'Pulogalamu ya Woimba',
    artist_creator: 'Sitolo ya Woimba',
    sign_in: 'Lowani',
    create_account: 'Pangani Akaunti',
    all: 'Zonse',
    cancel: 'Lekani',
    close: 'Tsekani',
    save: 'Sungani',
    saving: 'Ikusunga...',
    back: 'Bwererani',
    next: 'Pitilizani',
    share: 'Gawani',
    follow: 'Tsatirani',
    following: 'Mukutsatira',
    unfollow: 'Siyani kutsatira',
    like: 'Kondani',
    unlike: 'Chotsani kukonda',
    download: 'Tsitsani',
    downloaded: 'Zatsitsidwa',
    play_all: 'Lizani zonse',
    see_all: 'Onani zonse',
    verified: 'Wotsimikizika',
    song_singular: 'nyimbo',
    song_plural: 'nyimbo',
    play_singular: 'yalira',
    play_plural: 'zalira',
    like_singular: 'okonda',
    like_plural: 'okonda',
    follower_singular: 'wotsatira',
    follower_plural: 'otsatira',
    listener: 'Womvera',
    artist: 'Woimba',
    admin: 'Woyang\'anira',

    // Header & Notifications
    notifications: 'Zidziwitso',
    unread_count: 'Zosawerengedwa {count}',
    all_caught_up: 'Mwawerenga zonse',
    total_count: 'Zonse {count}',
    mark_all_read: 'Chongani zonse',
    enable_alerts_banner: 'Yatsani phokoso ndi zidziwitso za pafoni pa nyimbo zatsopano',
    enable: 'Yatsani',
    notif_tab_all: 'Zonse',
    notif_tab_unread: 'Zosawerengedwa',
    notif_tab_updates: 'Zatsopano',
    no_unread_notifs: 'Palibe zidziwitso zatsopano',
    no_updates_yet: 'Palibe zosintha pakadali pano',
    no_notifs_yet: 'Palibe zidziwitso pakadali pano',
    no_unread_desc: 'Mwawerenga zidziwitso zonse za oimba ndi akaunti yanu.',
    no_notifs_desc: 'Kuvomerezedwa kwa situdiyo, nyimbo zatsopano ndi zosintha zionekera pano.',
    open_artist_creator: 'Tsegulani Situdiyo →',
    view_artist: 'Onani Woimba →',
    open_arrow: 'Tsegulani →',
    just_now: 'Tsopano lino',
    minutes_ago: 'Mphindi {count} zapitazo',
    hours_ago: 'Maola {count} apitazo',
    active_alerts: 'Zidziwitso zofunikira tsopano',
    mark_read: 'Chongani',
    listening_session_label: 'Thanzi la makutu',
    break_prompt_title: 'Nthawi yopuma pang\'ono',
    break_prompt_body: 'Mwakhala mukumvera nyimbo mosalekeza kwa {duration}. Pumulitsani makutu kwa mphindi zochepa musanapitirize.',
    take_short_break: 'Pumani pang\'ono',
    continue_listening_btn: 'Pitilizani kumvera',
    break_taken_toast: 'Nyimbo zaimitsidwa — pumulani pang\'ono.',

    // Home & Discovery
    music_feed_for: 'Nyimbo zochokera ku {country}',
    liked_count_short: 'Zokondedwa {count}',
    following_count_short: 'Otsatira {count}',
    recently_played_count_short: 'Zomveredwa posachedwa {count}',
    play_mix: 'Lizani zonse',
    shuffling_tracks: 'Ikusakaniza nyimbo',
    playing_top_mix: 'Ikuliza nyimbo zotchuka',
    resume_song: 'Pitilizani kumvera',
    time_left: 'Kwatsala {time}',
    spotlight_suffix: 'Nyimbo za {genre}',
    top_genre_playing: 'Nyimbo zabwino za {genre} zikulira tsopano',
    public_playlists: 'Mindandanda ya anthu',
    public_playlists_sub: 'Nyimbo zosankhidwa ndi omvera kuti mumvere',
    picked_for_genres: 'Zosankhidwa malinga ndi zomwe mumakonda',
    based_on_genres: 'Kutengera {genres}',
    recommended_for_you: 'Zokuyenererani',
    recommended_for_you_sub: 'Nyimbo zosakanizidwa zatsopano nthawi iliyonse mukatsegula',
    mix_again: 'Sakanizaninso',
    daily_mix: 'Nyimbo za Tsiku ndi Tsiku',
    daily_mix_sub: 'Zosankhidwa malinga ndi mitundu yomwe mumamvera',
    artists_to_follow: 'Oimba oti muwatsatire',
    artists_to_follow_sub: 'Oimba odziyimira okha omwe akutulutsa nyimbo pa LOWERVIBE',
    because_you_played: 'Chifukwa munamvera {title}',
    similar_genre_sound: 'Mitundu ndi mamvekedwe ofanana',
    from_followed_artists: 'Kuchokera kwa oimba omwe mumawatsatira',
    latest_followed_sub: 'Nyimbo zatsopano za oimba omwe ali pa mndandanda wanu',
    trending_in_country: 'Zotchuka ku {country}',
    most_played_country: 'Nyimbo zomveredwa kwambiri ku {country}',
    could_not_load_music: 'Sitinathe kutenga nyimbo',
    try_again: 'Yesaninso',
    no_songs_yet: 'Palibe nyimbo zokwezedwa pakadali pano',
    no_songs_yet_sub: 'Kwezani nyimbo yoyamba pa LOWERVIBE kuti omvera ayambe kumvera nthawi yomweyo.',
    upload_a_song: 'Kwezani nyimbo',
    continue_listening: 'Pitirizani kumvera',
    featured_releases: 'Nyimbo Zatsopano',
    all_vibes: 'Nyimbo Zonse',
    vibe_frequencies: 'Sankhani Mtundu wa Nyimbo',
    vibe_subheading: 'Pezani nyimbo za ku Malawi, Nigeria ndi Africa yonse',
    submit_as_artist: 'Khalani Woimba',

    // Categorized Releases (AllTracksSection)
    explore_by_category: 'Nyimbo pa Mitundu Yake',
    explore_by_category_sub: 'Sankhani mtundu wa nyimbo kuti musapeze zovuta kufufuza',
    genre_tracks_title: 'Nyimbo za {genre}',
    tap_track_to_listen: 'Dinani nyimbo kapena mtundu uliwonse kuti muyambe kumvera',
    tab_categories: 'Mitundu',
    tab_charts: 'Zotchuka',
    tab_most_played: 'Zomveredwa Kwambiri',
    tab_newest: 'Zatsopano',
    show_all_categories: 'Mitundu yonse',
    nothing_matches_filter: 'Palibe nyimbo za mtundu uwu',
    try_another_filter: 'Yesani kusankha mtundu wina pamwambapa.',
    show_more_songs: 'Onetsani zina {count}',
    added_to_liked: 'Zawonjezedwa ku zokondedwa',
    removed_from_liked: 'Zachotsedwa ku zokondedwa',
    playing_next_toast: 'Ikuliza "{title}" pambuyo pake',
    play_next: 'Liza pambuyo pake',
    plays_count: 'Yalira {count}',
    songs_count_label: 'Nyimbo {count}',

    // Hero, New Releases, Top Ten & Vibe Trends
    featured_pick: 'Nyimbo Yosankhidwa',
    play_now: 'Lizani tsopano',
    view_artist_btn: 'Tsamba la woimba',
    track_details: 'Zambiri za nyimbo',
    new_releases_title: 'Zotuluka Zatsopano',
    new_releases_sub: 'Nyimbo zatsopano zomwe zaikidwa pa LOWERVIBE',
    top_ten_title: 'Nyimbo Zotsogola',
    top_ten_sub: 'Nyimbo zomveredwa kwambiri pakadali pano',

    // Player & Fullscreen Player
    now_playing: 'Ikulira Tsopano',
    play: 'Liza',
    pause: 'Imitsani',
    previous: 'Yam\'mbuyo',
    next_track: 'Yotsatira',
    repeat: 'Bwereza',
    repeat_one: 'Bwereza 1',
    repeat_all: 'Bwereza zonse',
    shuffle: 'Sakanizani',
    sleep_timer: 'Nthawi Yoimitsa',
    up_next: 'Zikubwera',
    lyrics: 'Mawu a Nyimbo',
    expand_lyrics: 'Tamulani Mawu',
    collapse_lyrics: 'Chepetsani Mawu',
    synced_lyrics: 'Mawu Ogwirizana ndi Nthawi',
    loading_lyrics: 'Ikufufuza mawu a nyimbo...',
    sync_to_playing: 'Bwererani pa mzere wolira',
    no_lyrics_yet: 'Palibe mawu a nyimboyi omwe apezeka pakali pano.',
    story_behind_song: 'Nkhani ya nyimboyi',
    audio_quality: 'Ubwino wa phokoso',
    equalizer: 'Kukonza phokoso',
    close_player: 'Tsekani',
    expand_player: 'Kulitsani choleretsa',
    add_to_playlist: 'Ikani m\'mndandanda',
    queue_empty: 'Palibe nyimbo zotsatira',
    timer_off: 'Zimitsidwa',
    timer_minutes: 'Mphindi {min}',
    timer_end_of_track: 'Nyimbo ikatha',

    // Footer & Cookie & Mobile CTA
    footer_tagline: 'Nyimbo zochokera ku Malawi, Nigeria ndi Africa yonse. Zapangidwira omvera ndi oimba kulikonse.',
    footer_explore: 'Fufuzani',
    footer_search_music: 'Sakani nyimbo',
    footer_your_library: 'Laibulale Yanu',
    footer_artists: 'Oimba',
    footer_your_profile: 'Mbiri Yanu',
    footer_legal: 'Malamulo',
    footer_terms: 'Malamulo Ogwiritsira Ntchito',
    footer_privacy: 'Chinsinsi cha Deta',
    footer_copyright: 'Ufulu wa Nyimbo',
    footer_contact: 'Lumikizanani Nafe',
    footer_language: 'Chilankhulo',
    footer_built_by: 'Yopangidwa ndi brownjnr',
    cookie_notice: 'LOWERVIBE imagwiritsa ntchito malo osungira a pafoni pakumvera ndi kusunga nyimbo popanda intaneti.',
    cookie_essential: 'Zofunikira zokha',
    cookie_accept_all: 'Vomerezani zonse',
    sticky_cta_title: 'Lowani pa LOWERVIBE kwaulere',
    sticky_cta_sub: 'Sungani nyimbo, pangani mindandanda ndi kuwonjezera chiwerengero chenicheni',

    // Install Prompt & Offline
    install_headline: 'Ikani LOWERVIBE pa foni yanu',
    install_body: 'Mverani nyimbo mosavuta, m\'mbuyo komanso popanda intaneti mukasunga nyimbo.',
    install_creator_headline: 'Ikani LOWERVIBE Creator',
    install_creator_body: 'Tsegulani situdiyo yanu ya woimba mwachindunji kuchokera pa foni.',
    install_button: 'Ikani tsopano',
    maybe_later: 'Pambuyo pake',
    offline_banner: 'Simuli pa intaneti — nyimbo zomwe munatsitsa zikulirabe m\'Laibulale.',
    online_restored: 'Mwabwereranso pa intaneti',

    // Share, Modals & Onboarding
    share_title: 'Gawani {name}',
    copy_link: 'Koperani ulalo',
    link_copied: 'Ulalo wakopedwa!',
    share_via: 'Gawani kudzera pa foni',
    open_artist_profile: 'Tsegulani Tsamba la Woimba',
    artist_gate_title: 'Khalani woimba wovomerezeka',
    artist_gate_body: 'Kwezani nyimbo, onani chiwerengero, ndipo pezani ndalama kuchokera ku omvera mukavomerezedwa.',
    apply_in_studio: 'Lembani mu Situdiyo',
    celebration_title: 'Takulandirani ku LOWERVIBE Creator!',
    celebration_body: 'Akaunti yanu ya woimba {name} yavomerezedwa. Tsegulani situdiyo kuti mukweze nyimbo yanu yoyamba.',
    go_to_studio: 'Tsegulani Situdiyo',
    add_to_playlist_title: 'Sungani m\'mndandanda',
    create_playlist: 'Pangani mndandanda watsopano',
    playlist_name_placeholder: 'Dzina la mndandanda...',
    make_public: 'Mndandanda wa aliyense',
    onboarding_title: 'Sankhani zomwe mumakonda',
    onboarding_subtitle: 'Tiuzeni zomwe mumakonda kuti LOWERVIBE ikupatseni nyimbo zabwino.',
    onboarding_finish: 'Yambani kumvera',
    tour_skip: 'Dumphani',
    tour_next: 'Pitilizani',
    tour_done: 'Zamveka!',

    // Discover, Library, Search, Artists, Track/Artist Public Pages
    discover_title: 'Pezani Nyimbo',
    discover_subtitle: 'Sankhani malinga ndi mtundu, maganizo, dziko kapena liwiro',
    all_genres: 'Mitundu yonse',
    all_moods: 'Maganizo onse',
    all_countries: 'Maiko onse',
    sort_by: 'Sankhani malinga ndi',
    sort_trending: 'Zotchuka',
    sort_newest: 'Zatsopano',
    sort_most_liked: 'Zokondedwa kwambiri',
    load_more_songs: 'Onetsani nyimbo zina (kwatsala {count})',
    loading_more_songs: 'Ikutenga nyimbo zina...',
    library_title: 'Laibulale Yanu',
    library_liked: 'Zokondedwa',
    library_offline: 'Zopanda Intaneti',
    library_following: 'Omwe Mukutsatira',
    library_playlists: 'Mindandanda',
    library_history: 'Mbiri Yakale',
    artists_roster_title: 'Oimba pa LOWERVIBE',
    artists_roster_sub: 'Oimba odziyimira okha omwe akugawana nyimbo zawo',
    search_title: 'Sakani pa LOWERVIBE',
    search_empty_prompt: 'Lembani dzina la nyimbo, woimba, mtundu kapena mawu',
    no_results_found: 'Palibe zopezeka',
    artist_songs: 'Nyimbo',
    artist_popular: 'Nyimbo zotchuka',
    artist_about: 'Zambiri',
    play_count_note_guest: 'Mukumvera kwaulere — lowani kuti musunge zokondedwa ndi kuwonjezera chiwerengero.',

    // Settings & Profile
    settings: 'Zokonda',
    appearance: 'Maonekedwe',
    appearance_language: 'Maonekedwe & Chilankhulo',
    language: 'Chilankhulo',
    playback: 'Malizidwe',
    data_storage: 'Deta & Malo Osungira',
    privacy: 'Chinsinsi',
    privacy_safety: 'Chinsinsi & Chitetezo',
    creator: 'Woimba',
    creator_tools: 'Zida za Woimba',
    support_about: 'Thandizo & Zambiri',
    account: 'Akaunti',
    sign_out: 'Tulukani',
    saved: 'Zasungidwa',
    edit_profile: 'Konzani mbiri',
    close_editor: 'Tsekani',
    share_profile: 'Gawani mbiri',
    view_public_profile: 'Onani tsamba la aliyense',
    browsing_as_guest: 'Mukugwiritsa ntchito ngati mlendo',
    sign_in_profile: 'Lowani mu akaunti yanu',
    guest_profile_sub: 'Sungani nyimbo zokondedwa, pangani mindandanda, tsatirani oimba a ku Malawi ndi Africa, kapena kwezani nyimbo zanu.',
    followers: 'Otsatira',
    playlists_label: 'Mindandanda',

    // Auth Portal
    auth_sign_in_tab: 'Lowani',
    auth_sign_up_tab: 'Pangani akaunti',
    auth_continue_guest: 'Pitirizani kumvera ngati mlendo',
    auth_forgot_password: 'Mwaiwala mawu achinsinsi?',
    auth_continue_google: 'Pitirizani ndi Google',
    auth_email_or_username: 'Imelo kapena @dzina',
    auth_password: 'Mawu achinsinsi',
    auth_remember_device: 'Ndisungebe nditalowa pa chipangizo ichi',

    // Studio / Artist Creator
    studio_signin_title: 'Lowani kuti mutsegule Situdiyo',
    studio_signin_sub: 'Kwezani nyimbo, yang\'anirani chiwerengero, ndipo onerani ndalama zanu.',
    studio_pending_badge: 'Fomu yanu ikuyang\'aniridwa',
    studio_pending_title: 'Chonde dikirani kuvomerezedwa ngati woimba',
    studio_pending_sub: 'Talandira pempho lanu. Gulu lathu limayang\'anira oimba onse kuti LOWERVIBE ikhale yodalirika — mudzalandira uthenga Situdiyo ikatsegulidwa.',
    studio_apply_title: 'Lembani kuti mukhale Woimba',
    studio_reapply_title: 'Konzani & tumizaninso pempho la woimba',
    studio_apply_sub: 'Tumizani zambiri zanu kuti muyang\'aniridwe mwachangu ndi kutsegula kukweza nyimbo.',
    studio_submit_btn: 'Tumizani pempho',
    studio_submitting: 'Ikutumiza...',
    studio_tab_overview: 'Chidule',
    studio_tab_upload: 'Kwezani',
    studio_tab_tracks: 'Nyimbo ({count})',
    studio_tab_analytics: 'Ziwerengero',
    studio_tab_monetization: 'Malipiro',
    studio_tab_withdrawals: 'Kutenga Ndalama',
    studio_published_songs: 'Nyimbo zotulutsidwa',
    studio_real_plays: 'Kuwerenga kwenikweni',
    studio_track_likes: 'Okonda nyimbo',
    studio_total_earnings: 'Ndalama Zonse',
    studio_back_home: 'Bwererani Kunyumba',
    studio_go_profile: 'Pitani ku Mbiri Yanu',

    // Major Upgrade: Search, Home, Banners, Moderation, About (Chichewa)
    search_no_match: 'Palibe chomwe chagwirizana ndi zomwe mwasaka pakadali pano.',
    search_suggestions_heading: 'Yesani kufufuza mitundu iyi, oimba, kapena nyimbo zotchuka',
    clear_history: 'Fufutani mbiri',
    recently_played_title: 'Zomveredwa Posachedwa',
    recently_played_sub: 'Nyimbo zomwe mwangomvera posachedwapa',
    trending_in_malawi: 'Zotchuka ku Malawi',
    trending_in_malawi_sub: 'Nyimbo zaku Malawi zomwe zikukondedwa ndi kumveredwa kwambiri',
    regional_africa_title: 'Nyimbo za M\'maiko Ena a Africa',
    regional_africa_sub: 'Mamvekedwe atsopano ochokera kumadera osiyanasiyana a Africa',
    popular_music_title: 'Nyimbo Zokondedwa Kwambiri',
    popular_music_sub: 'Nyimbo zomwe zikumveredwa kwambiri pa LOWERVIBE',
    featured_playlists_title: 'Mindandanda Yosankhidwa',
    footer_about: 'Zokhudza LOWERVIBE',
    about_title: 'Zokhudza LOWERVIBE',
    about_subtitle: 'Nsanja yodziyimira yokha yomvera nyimbo zaku Malawi ndi Africa yonse.',
    banner_dismiss: 'Tsekani',
    banner_retry: 'Yesaninso kukweza',
    banner_essential_badge: 'Akaunti & Ntchito',
    banner_promo_badge: 'Zatsopano',
    reduced_motion_label: 'Chepetsani kusuntha kwa zithunzi',
    reduced_motion_desc: 'Zimathandiza kuti foni zing\'onozing\'ono zigwire ntchito mwachangu',
    comments_disabled: 'Ndemanga zatsekedwa pa nyimboyi.',
    report_comment: 'Nenani ndemangayi',
    delete_comment: 'Fufutani ndemanga',

    // FCM Push, Audio Quality & Offline Batch Sync (Chichewa)
    fcm_push_title: 'Mauthenga a pa Screen (FCM Push)',
    fcm_push_active: 'Mauthenga a pa screen atsegulidwa',
    fcm_push_enable: 'Tsegulani Mauthenga a pa Screen',
    fcm_push_disable: 'Imitsani Mauthenga pa Foni Iyi',
    fcm_push_missing_vapid: 'Ikani VITE_FIREBASE_VAPID_KEY kuti mulandire mauthenga pulogalamu itatsekedwa.',
    fcm_push_blocked: 'Mauthenga anatsekedwa m\'zokonda za browser yanu.',
    fcm_push_syncing: 'Ikulumikiza...',
    quality_auto_desc: 'Imasintha pakati pa 96 kbps ndi 320 kbps',
    quality_saver_96: 'Sungani Deta · 96 kbps',
    quality_high_320: 'Mwapamwamba · 320 kbps',
    data_saver_toggle: 'Sungani Deta ya Foni (96 kbps)',
    switched_quality_toast: 'Mtundu wa mawu wasinthidwa kukhala {quality}',
    save_playlist_offline: 'Sungani mndandanda popanda intaneti',
    sync_remaining_offline: 'Sungani {count} zotsala',
    playlist_saved_offline: 'Zasungidwa popanda intaneti',
    save_releases_offline: 'Sungani nyimbo zonse',
    releases_saved_offline: 'Zasungidwa',
    remove_offline_batch: 'Chotsani zosungidwa',
    syncing_offline_progress: 'Ikusunga {completed}/{total}',
  },
};

export function interpolateTranslation(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}

export function getLocalizedGreeting(language: Language, name?: string): string {
  const hour = new Date().getHours();
  let base: string;
  if (language === 'ny') {
    base = hour < 12 ? 'Mwadzuka bwanji' : hour < 18 ? 'Mwaswera bwanji' : 'Madzulo abwino';
  } else {
    base = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${base}, ${first}` : base;
}

export function formatLocalizedRelativeTime(isoDate: string, language: Language): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (diffSec < 60) {
    return TRANSLATIONS[language].just_now || 'Just now';
  }
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return interpolateTranslation(TRANSLATIONS[language].minutes_ago || '{count}m ago', {
      count: mins,
    });
  }
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    return interpolateTranslation(TRANSLATIONS[language].hours_ago || '{count}h ago', {
      count: hrs,
    });
  }
  return new Date(isoDate).toLocaleDateString(language === 'ny' ? 'en-MW' : undefined);
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string;
  currentLanguage: LanguageOption;
  availableLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
export const LANG_STORAGE_KEY = 'lowervibe_preferred_lang_v2';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'ny') return saved;
    } catch {}
    return 'en';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'ny' ? 'ny' : 'en';
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {}
  };

  const t = (
    key: string,
    fallback?: string,
    vars?: Record<string, string | number>
  ): string => {
    const template = TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || fallback || key;
    return interpolateTranslation(template, vars);
  };

  const currentLanguage = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLanguage,
        availableLanguages: LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: (key: string, fallback?: string, vars?: Record<string, string | number>) =>
        interpolateTranslation(TRANSLATIONS.en[key] || fallback || key, vars),
      currentLanguage: LANGUAGES[0],
      availableLanguages: LANGUAGES,
    };
  }
  return context;
};
