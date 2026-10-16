import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { download } from './allinone.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon'
};

function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  res.end(JSON.stringify(data));
}

function normalize(data) {
  const media = [];
  const add = (title, url, type = 'video', thumbnail = null) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      media.push({ title, url, type, thumbnail });
    }
  };
  if (data.platform === 'instagram') {
    (data.videos || []).forEach((v, i) => add(`Video ${i + 1}`, v.url, 'video', v.thumbnail));
    (data.images || []).forEach((v, i) => add(`Foto ${i + 1}`, typeof v === 'string' ? v : (v?.url || v?.image), 'image'));
  } else if (data.platform === 'tiktok') {
    if (data.video) {
      add('Video tanpa watermark', data.video.noWatermark, 'video', data.video.cover);
      if (data.video.hd && data.video.hd !== data.video.noWatermark) add('Video HD', data.video.hd, 'video', data.video.cover);
      if (!data.video.noWatermark) add('Video', data.video.hd || data.video.watermark, 'video', data.video.cover);
    }
    (data.images || []).forEach((v, i) => add(`Foto ${i + 1}`, typeof v === 'string' ? v : (v?.url || v?.url_list?.[0]), 'image'));
    if (data.audio) add('Audio', data.audio, 'audio');
  } else if (data.platform === 'twitter') {
    (data.media?.videos || []).forEach((v, i) => add(`Video ${i + 1}`, v.downloadUrl || v.variants?.[0]?.url, 'video', v.thumbnail));
    (data.media?.photos || []).forEach((v, i) => add(`Foto ${i + 1}`, v, 'image'));
  } else if (data.platform === 'dailymotion' || data.platform === 'vimeo') {
    add(data.title || 'Video', data.streamUrl, 'video', data.thumbnail);
  } else if (data.platform === 'snackvideo' || data.platform === 'capcut') {
    add(data.title || 'Video', data.videoUrl, 'video', data.poster);
  }
  return {
    platform: data.platform,
    title: data.title || data.text || '',
    author: data.author?.nickname || data.author?.name || data.author?.username || '',
    sourceUrl: data.sourceUrl,
    type: data.type || 'media',
    media
  };
}

async function handleApi(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    });
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Gunakan metode POST.' });
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_000) return json(res, 413, { error: 'Permintaan terlalu besar.' });
  }
  let parsed;
  try { parsed = JSON.parse(body || '{}'); }
  catch { return json(res, 400, { error: 'Format permintaan tidak valid.' }); }
  const input = typeof parsed.url === 'string' ? parsed.url.trim() : '';
  let parsedUrl;
  try { parsedUrl = new URL(input); }
  catch { return json(res, 400, { error: 'Masukkan link video yang valid.' }); }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return json(res, 400, { error: 'Hanya link HTTP/HTTPS yang didukung.' });
  }
  const host = parsedUrl.hostname.toLowerCase();
  const supported = [
    'tiktok.com', 'instagram.com', 'instagr.am', 'x.com', 'twitter.com',
    'dailymotion.com', 'dai.ly', 'snackvideo.com', 'kwai.com',
    'kuaishou.com', 'capcut.com', 'vimeo.com'
  ];
  if (!supported.some(d => host === d || host.endsWith('.' + d))) {
    return json(res, 400, { error: 'Platform belum didukung. Tempel link dari TikTok, Instagram, X/Twitter, SnackVideo, CapCut, Dailymotion, atau Vimeo.' });
  }
  try {
    const data = await download(input);
    const result = normalize(data);
    if (!result.media.length) {
      return json(res, 502, {
        error: 'API merespons, tetapi tidak menemukan media yang bisa ditampilkan. Link mungkin privat, dibatasi, atau format API sudah berubah.',
        platform: data.platform,
        sourceUrl: data.sourceUrl || input
      });
    }
    return json(res, 200, result);
  } catch (error) {
    return json(res, 502, {
      error: error?.message || 'API downloader gagal memproses link.',
      hint: 'Coba link publik lain. API pihak ketiga bisa berubah atau membatasi permintaan.'
    });
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (requestUrl.pathname === '/api/download') return handleApi(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); return res.end('Method Not Allowed');
  }
  let pathname = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
  const resolved = path.resolve(__dirname, '.' + pathname);
  if (!resolved.startsWith(__dirname + path.sep) && resolved !== path.join(__dirname, 'index.html')) {
    res.writeHead(403); return res.end('Forbidden');
  }
  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) throw new Error('Not a file');
    const content = await readFile(resolved);
    res.writeHead(200, { 'content-type': MIME[path.extname(resolved)] || 'application/octet-stream' });
    return req.method === 'HEAD' ? res.end() : res.end(content);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('File tidak ditemukan');
  }
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`MujotDownloader berjalan di http://localhost:${PORT}`);
});
