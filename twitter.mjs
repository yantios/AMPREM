const BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
const ENDPOINT_PRIMARY = 'https://api.x.com/graphql/5GOHgZe-8U2j5sVHQzEm9A/TweetResultByRestId';
const ENDPOINT_FALLBACK = 'https://api.x.com/graphql/_y7SZqeOFfgEivILXIy3tQ/TweetResultByRestId';
const GUEST_ACTIVATE_URL = 'https://api.twitter.com/1.1/guest/activate.json';

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

let cachedGuestToken = null;
let guestTokenExpiresAt = 0;

async function getGuestToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedGuestToken && now < guestTokenExpiresAt) {
    return cachedGuestToken;
  }
  const res = await fetch(GUEST_ACTIVATE_URL, {
    method: 'POST',
    headers: {
      'Authorization': BEARER,
      'User-Agent': DEFAULT_UA
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to activate Twitter guest token (${res.status})`);
  }
  const data = await res.json();
  if (!data?.guest_token) {
    throw new Error('Twitter guest token response missing token');
  }
  cachedGuestToken = data.guest_token;
  guestTokenExpiresAt = now + 10800000;
  return cachedGuestToken;
}

async function resolveTweetId(input) {
  if (!input) throw new Error('Tweet URL or ID is required');
  const str = String(input).trim();
  if (/^\d+$/.test(str)) return str;

  let targetUrl = str;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  if (targetUrl.includes('t.co/')) {
    const headRes = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': DEFAULT_UA }
    });
    targetUrl = headRes.url;
  }

  const match = targetUrl.match(/status\/(\d+)/i) || targetUrl.match(/\/(\d{8,})/);
  if (!match) {
    throw new Error(`Unable to extract Tweet ID from: ${input}`);
  }
  return match[1];
}

const GRAPHQL_FEATURES_V1 = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: false,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_home_pinned_timelines_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_media_download_video_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false
};

const GRAPHQL_FEATURES_V2 = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_analysis_button_from_backend: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false
};

const FIELD_TOGGLES_V2 = {
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false
};

async function executeGraphqlQuery(endpoint, variables, features, fieldToggles = null, guestToken) {
  const params = {
    variables: JSON.stringify(variables),
    features: JSON.stringify(features)
  };
  if (fieldToggles) {
    params.fieldToggles = JSON.stringify(fieldToggles);
  }
  const qs = new URLSearchParams(params);
  const targetUrl = `${endpoint}?${qs.toString()}`;

  const res = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'Authorization': BEARER,
      'x-guest-token': guestToken,
      'User-Agent': DEFAULT_UA,
      'Accept': '*/*'
    }
  });

  if (res.status === 401 || res.status === 403) {
    const err = new Error(`Twitter unauthorized (${res.status})`);
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  if (!res.ok) {
    throw new Error(`Twitter GraphQL request failed with status ${res.status}`);
  }

  return res.json();
}

export async function getTweet(urlOrId) {
  const tweetId = await resolveTweetId(urlOrId);
  let guestToken = await getGuestToken(false);

  const variables = {
    tweetId,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false
  };

  let json;
  try {
    json = await executeGraphqlQuery(ENDPOINT_PRIMARY, variables, GRAPHQL_FEATURES_V1, null, guestToken);
  } catch (err) {
    if (err.code === 'UNAUTHORIZED') {
      guestToken = await getGuestToken(true);
      json = await executeGraphqlQuery(ENDPOINT_PRIMARY, variables, GRAPHQL_FEATURES_V1, null, guestToken);
    } else {
      json = await executeGraphqlQuery(ENDPOINT_FALLBACK, variables, GRAPHQL_FEATURES_V2, FIELD_TOGGLES_V2, guestToken);
    }
  }

  const rawResult = json?.data?.tweetResult?.result;
  if (!rawResult || Object.keys(rawResult).length === 0) {
    throw new Error(`Tweet not found or unavailable for ID: ${tweetId}`);
  }

  const legacy = rawResult?.legacy || rawResult?.tweet?.legacy || {};
  const userLegacy = rawResult?.core?.user_results?.result?.legacy || rawResult?.tweet?.core?.user_results?.result?.legacy || {};
  const mediaEntities = legacy?.extended_entities?.media || legacy?.entities?.media || [];

  const photos = [];
  const videos = [];

  for (const m of mediaEntities) {
    if (m.type === 'photo') {
      photos.push(m.media_url_https || m.media_url);
    } else if (m.type === 'video' || m.type === 'animated_gif') {
      const variants = m?.video_info?.variants || [];
      const mp4s = variants
        .filter((v) => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
        .map((v) => {
          let quality = 'unknown';
          const match = v.url.match(/\/vid\/(?:avc1|mp4)\/(\d+x\d+)\//);
          if (match) {
            quality = match[1];
          } else if (v.bitrate) {
            quality = `${Math.round(v.bitrate / 1000)}k`;
          }
          return {
            quality,
            bitrate: v.bitrate || 0,
            url: v.url
          };
        });

      videos.push({
        type: m.type,
        thumbnail: m.media_url_https || m.media_url,
        aspectRatio: m?.video_info?.aspect_ratio || null,
        duration: m?.video_info?.duration_millis || 0,
        variants: mp4s,
        downloadUrl: mp4s[0]?.url || null
      });
    }
  }

  let postType = 'text';
  if (videos.length > 0) {
    postType = videos[0].type === 'animated_gif' ? 'animated_gif' : 'video';
  } else if (photos.length > 0) {
    postType = 'photo';
  }

  const screenName = userLegacy.screen_name || '';

  return {
    id: tweetId,
    url: screenName ? `https://x.com/${screenName}/status/${tweetId}` : `https://x.com/i/status/${tweetId}`,
    type: postType,
    text: legacy.full_text || '',
    createdAt: legacy.created_at || null,
    author: {
      name: userLegacy.name || null,
      username: screenName || null,
      avatar: userLegacy.profile_image_url_https || userLegacy.profile_image_url || null,
      verified: Boolean(rawResult?.core?.user_results?.result?.is_blue_verified || userLegacy.verified)
    },
    stats: {
      likes: legacy.favorite_count || 0,
      retweets: legacy.retweet_count || 0,
      replies: legacy.reply_count || 0,
      quotes: legacy.quote_count || 0,
      views: Number(rawResult?.views?.count || 0)
    },
    media: {
      totalVideos: videos.length,
      totalPhotos: photos.length,
      videos,
      photos
    }
  };
}

export async function downloadVideo(urlOrId) {
  const tweet = await getTweet(urlOrId);
  const firstVideo = tweet.media.videos[0];
  if (!firstVideo?.downloadUrl) {
    throw new Error('No video found in this tweet');
  }
  return firstVideo.downloadUrl;
}

export async function downloadAudio(urlOrId) {
  const videoUrl = await downloadVideo(urlOrId);
  return videoUrl;
}

export async function downloadPhotos(urlOrId) {
  const tweet = await getTweet(urlOrId);
  if (!tweet.media.photos.length) {
    throw new Error('No photos found in this tweet');
  }
  return tweet.media.photos;
}

export default {
  getTweet,
  downloadVideo,
  downloadAudio,
  downloadPhotos
};
