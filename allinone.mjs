import crypto from 'node:crypto';
import { getTweet } from './twitter.mjs';

const AES_KEY = Buffer.from('qwertyuioplkjhgf', 'utf-8');
const BASE_ORIGIN = 'https://fastvideosave.net';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function encryptUrl(url) {
  const cipher = crypto.createCipheriv('aes-128-ecb', AES_KEY, null);
  cipher.setAutoPadding(true);
  let hex = cipher.update(url.trim(), 'utf-8', 'hex');
  hex += cipher.final('hex');
  return hex;
}

export async function downloadInstagram(url) {
  if (!url || typeof url !== 'string') throw new Error('Valid Instagram URL is required');
  const target = url.trim();
  const res = await fetch('https://api.videodropper.app/allinone', {
    headers: {
      'accept': '*/*',
      'origin': BASE_ORIGIN,
      'referer': BASE_ORIGIN + '/',
      'url': encryptUrl(target),
      'user-agent': USER_AGENT
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const videos = (data.video || []).map(v => ({
    url: v.video,
    thumbnail: v.thumbnail || null
  }));

  const images = (data.image || []).map(img => (typeof img === 'string' ? img : img.url || img.image));

  return {
    platform: 'instagram',
    sourceUrl: target,
    type: videos.length > 0 ? (images.length > 0 ? 'carousel' : 'video') : 'image',
    totalVideos: videos.length,
    totalImages: images.length,
    videos,
    images
  };
}

export async function downloadTikTok(url) {
  if (!url || typeof url !== 'string') throw new Error('Valid TikTok URL is required');
  const target = url.trim();
  const res = await fetch('https://www.tikwm.com/api/?url=' + encodeURIComponent(target) + '&hd=1', {
    headers: { 'User-Agent': USER_AGENT }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0 || !json.data) throw new Error(json.msg || 'TikTok error');
  const d = json.data;
  const isSlide = Array.isArray(d.images) && d.images.length > 0;

  return {
    platform: 'tiktok',
    sourceUrl: target,
    type: isSlide ? 'slides' : 'video',
    id: d.id,
    title: d.title || '',
    author: {
      username: d.author?.unique_id,
      nickname: d.author?.nickname,
      avatar: d.author?.avatar
    },
    video: isSlide ? null : {
      noWatermark: d.play,
      hd: d.hdplay || d.play,
      watermark: d.wmplay,
      cover: d.cover,
      duration: d.duration
    },
    images: isSlide ? d.images : [],
    audio: d.music || null
  };
}

export async function downloadTwitter(url) {
  if (!url || typeof url !== 'string') throw new Error('Valid Twitter / X URL is required');
  const tweet = await getTweet(url);
  return {
    platform: 'twitter',
    sourceUrl: tweet.url,
    id: tweet.id,
    type: tweet.type,
    text: tweet.text,
    author: tweet.author,
    stats: tweet.stats,
    media: tweet.media
  };
}

export async function downloadDailymotion(url) {
  if (!url || typeof url !== 'string') throw new Error('Valid Dailymotion URL is required');
  let id = null;
  const m1 = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (m1) id = m1[1];
  const m2 = url.match(/dai\.ly\/([a-zA-Z0-9]+)/);
  if (m2) id = m2[1];
  if (!id) throw new Error('Invalid Dailymotion URL');

  const [metaRes, playerRes] = await Promise.all([
    fetch(`https://api.dailymotion.com/video/${id}?fields=id,title,duration,thumbnail_720_url`),
    fetch(`https://www.dailymotion.com/player/metadata/video/${id}`)
  ]);
  const meta = await metaRes.json();
  const player = await playerRes.json();
  const streamUrl = player.qualities?.auto?.[0]?.url || null;

  return {
    platform: 'dailymotion',
    sourceUrl: url,
    type: 'video',
    id: meta.id || id,
    title: meta.title || '',
    duration: meta.duration || 0,
    thumbnail: meta.thumbnail_720_url || null,
    streamUrl
  };
}

export async function downloadSnackVideo(url) {
  if (!url || typeof url !== 'string') throw new Error('Valid SnackVideo / Kwai URL is required');
  const target = url.trim();
  const res = await fetch(target, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const videoMatch = html.match(/src:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i) ||
                     html.match(/<video[^>]*src=["']([^"']+)["']/i) ||
                     html.match(/(https:\/\/[^"'\s<>]*(?:kwai\.net|snackvideo)[^"'\s<>]+\.mp4[^"'\s<>]*)/i);
  const posterMatch = html.match(/poster:\s*["'](https?:\/\/[^"']+)["']/i) ||
                      html.match(/<video[^>]*poster=["']([^"']+)["']/i);
  const captionMatch = html.match(/caption:\s*"([^"]+)"/);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

  if (!videoMatch) throw new Error('Video stream not found on this SnackVideo page');

  return {
    platform: 'snackvideo',
    sourceUrl: res.url || target,
    type: 'video',
    title: captionMatch ? captionMatch[1] : (titleMatch ? titleMatch[1].trim() : ''),
    poster: posterMatch ? posterMatch[1] : null,
    videoUrl: videoMatch[1]
  };
}

export async function downloadCapCut(url) {
  if (!url || typeof url !== 'string') throw new Error('Valid CapCut URL is required');
  const res = await fetch(url.trim(), {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const vodMatch = html.match(/(https:\/\/[^"'\s<>]*(?:capcutvod\.com)[^"'\s<>]+)/i);
  const posterMatch = html.match(/(https:\/\/[^"'\s<>]*(?:ibyteimg\.com)[^"'\s<>]+)/i);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

  if (!vodMatch) throw new Error('Video not found on CapCut page');
  return {
    platform: 'capcut',
    sourceUrl: url.trim(),
    type: 'video',
    title: titleMatch ? titleMatch[1].replace(/ - (?:video template by )?CapCut/i, '').trim() : '',
    poster: posterMatch ? posterMatch[1].replace(/&amp;/g, '&') : null,
    videoUrl: vodMatch[1].replace(/&amp;/g, '&')
  };
}

export async function downloadVimeo(url) {
  if (!url || typeof url !== 'string') throw new Error('Valid Vimeo URL is required');
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (!match) throw new Error('Invalid Vimeo URL');
  const id = match[1];
  const res = await fetch(`https://player.vimeo.com/video/${id}/config`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const video = data.video || {};
  const hls = data.request?.files?.hls;
  const streamUrl = hls?.cdns?.[hls?.default_cdn]?.url || null;

  return {
    platform: 'vimeo',
    sourceUrl: url.trim(),
    type: 'video',
    id,
    title: video.title || '',
    duration: video.duration || 0,
    thumbnail: video.thumbs?.base || null,
    streamUrl
  };
}

export async function download(url) {
  if (!url || typeof url !== 'string') throw new Error('URL string is required');
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return downloadInstagram(url);
  if (lower.includes('tiktok.com')) return downloadTikTok(url);
  if (lower.includes('twitter.com') || lower.includes('x.com')) return downloadTwitter(url);
  if (lower.includes('dailymotion.com') || lower.includes('dai.ly')) return downloadDailymotion(url);
  if (lower.includes('snackvideo.com') || lower.includes('kwai.com') || lower.includes('kuaishou.com')) return downloadSnackVideo(url);
  if (lower.includes('capcut.com')) return downloadCapCut(url);
  if (lower.includes('vimeo.com')) return downloadVimeo(url);
  throw new Error('Unsupported platform URL');
}
