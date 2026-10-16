const platformCards = [...document.querySelectorAll('.platform-card')];
const platformHint = document.getElementById('platformHint');
const input = document.getElementById('urlInput');
const status = document.getElementById('urlStatus');
const result = document.getElementById('result');
const platformLabels = {
  tiktok: 'TikTok', instagram: 'Instagram', twitter: 'X / Twitter',
  snackvideo: 'SnackVideo', capcut: 'CapCut', dailymotion: 'Dailymotion', vimeo: 'Vimeo'
};
const platformIcons = {
  tiktok: '♪', instagram: '◎', twitter: '𝕏', snackvideo: '▶',
  capcut: '⧉', dailymotion: 'd', vimeo: 'v'
};

platformCards.forEach((card) => {
  card.addEventListener('click', () => {
    platformCards.forEach((item) => item.classList.remove('selected'));
    card.classList.add('selected');
    const platform = card.dataset.platform;
    const label = platformLabels[platform] || 'TikTok';
    const selectedName = document.getElementById('selectedName');
    const selectedIcon = document.getElementById('selectedIcon');
    if (selectedName) selectedName.textContent = label;
    if (selectedIcon) {
      selectedIcon.className = `platform-logo ${platform}`;
      selectedIcon.textContent = platformIcons[platform] || '♪';
    }
    if (platformHint) platformHint.textContent = `Tempel link ${label} di kolom bawah`;
    input.placeholder = `Tempel link ${label} di sini...`;
    input.focus();
    document.getElementById('downloader')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

input.addEventListener('input', () => {
  status.textContent = input.value.trim() ? 'Tautan dimasukkan' : 'Menunggu tautan';
  result.className = 'result-box';
  result.replaceChildren();
});

document.getElementById('pasteBtn').addEventListener('click', async () => {
  try {
    if (!navigator.clipboard?.readText) throw new Error('Clipboard tidak tersedia');
    const value = await navigator.clipboard.readText();
    if (value) {
      input.value = value.trim();
      input.dispatchEvent(new Event('input'));
    } else status.textContent = 'Clipboard kosong';
  } catch {
    input.focus();
    status.textContent = 'Tekan lama kolom lalu pilih Tempel';
  }
});

document.getElementById('downloadForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const rawUrl = input.value.trim();
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    showMessage('Masukkan link yang valid, diawali https:// atau http://.', true);
    return;
  }

  if (location.protocol === 'file:') {
    showMessage('API perlu server Node.js. Ekstrak ZIP, jalankan `npm start`, lalu buka http://localhost:3000.', true);
    return;
  }

  const button = document.querySelector('.download-btn');
  const originalButtonText = button.querySelector('span:first-child').textContent;
  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'Memproses link...';
  status.textContent = 'Menghubungi API';
  showMessage('Sedang mengambil data media. Tunggu sebentar...', false);

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: rawUrl })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `API gagal (${response.status})`);
    renderResults(data);
    status.textContent = 'Media ditemukan';
  } catch (error) {
    showMessage(`${error.message || 'Tidak bisa memproses link.'} Pastikan website dijalankan melalui server Node.js dengan perintah npm start.`, true);
    status.textContent = 'Proses gagal';
  } finally {
    button.disabled = false;
    button.querySelector('span:first-child').textContent = originalButtonText;
  }
});

function showMessage(message, isError) {
  result.className = `result-box show${isError ? ' error' : ''}`;
  result.replaceChildren();
  const text = document.createElement('p');
  text.textContent = message;
  text.style.margin = '0';
  result.append(text);
}

function renderResults(data) {
  result.className = 'result-box show';
  result.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'result-heading';
  heading.textContent = `${data.platform || 'Media'}${data.title ? ` — ${data.title}` : ''}`;
  result.append(heading);

  if (data.author) {
    const author = document.createElement('p');
    author.className = 'result-author';
    author.textContent = `Oleh ${data.author}`;
    result.append(author);
  }

  (data.media || []).forEach((media, index) => {
    const row = document.createElement('div');
    row.className = 'media-result';
    const label = document.createElement('span');
    label.textContent = media.title || `Media ${index + 1}`;
    const link = document.createElement('a');
    link.href = media.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Unduh / buka ↗';
    link.setAttribute('download', '');
    row.append(label, link);
    result.append(row);
  });

  const note = document.createElement('p');
  note.className = 'result-note';
  note.textContent = 'Jika file terbuka di tab baru, gunakan menu browser untuk menyimpan. Beberapa stream HLS atau platform mungkin tidak mendukung unduhan langsung.';
  result.append(note);
}
