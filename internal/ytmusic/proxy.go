package ytmusic

// Proxy audio dan gambar. Audio lewat proxy = same-origin, jadi Web Audio (Audio Dinamis/EQ) bisa dipakai
// dan hotlink/Referer converter tidak menghalangi.

import (
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

var pc = &http.Client{Timeout: 0}
var ic = &http.Client{Timeout: 15 * time.Second}

// hostPrivat true bila host mengarah ke alamat lokal/privat (mencegah SSRF).
func hostPrivat(h string) bool {
	ips, err := net.LookupIP(h)
	if err != nil || len(ips) == 0 {
		return true
	}
	for _, ip := range ips {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() {
			return true
		}
	}
	return false
}

func salin(w http.ResponseWriter, resp *http.Response, u *url.URL) {
	for _, h := range []string{"Content-Length", "Content-Range", "Accept-Ranges", "Cache-Control"} {
		if v := resp.Header.Get(h); v != "" {
			w.Header().Set(h, v)
		}
	}
	ct := resp.Header.Get("Content-Type")
	p := strings.ToLower(u.Path)
	if ct == "" || strings.HasPrefix(ct, "application/octet-stream") || strings.HasPrefix(ct, "binary/") {
		switch {
		case strings.HasSuffix(p, ".mp3"):
			ct = "audio/mpeg"
		case strings.HasSuffix(p, ".m4a"), strings.HasSuffix(p, ".mp4"):
			ct = "audio/mp4"
		}
	}
	if ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// Proxy: GET /api/proxy?url=... (http/https, mendukung Range). Batasi domain dengan env PROXY_ALLOW bila perlu.
func Proxy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	u, err := url.Parse(r.URL.Query().Get("url"))
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || !AllowedHost(u.Hostname()) || hostPrivat(u.Hostname()) {
		http.Error(w, "url tidak diizinkan", http.StatusForbidden)
		return
	}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, u.String(), nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://loader.to/")
	req.Header.Set("Origin", "https://loader.to")
	rg := r.Header.Get("Range")
	// Vercel membatasi respons function sekitar 4,5 MB. MP3 320kbps jauh lebih besar,
	// jadi di Vercel kita potong per potongan 4 MB; browser otomatis minta potongan berikutnya.
	if os.Getenv("VERCEL") != "" {
		rg = batasiRange(rg, 4<<20)
	}
	if rg != "" {
		req.Header.Set("Range", rg)
	}
	resp, err := pc.Do(req)
	if err != nil {
		http.Error(w, "gagal mengambil audio", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	salin(w, resp, u)
}

// ImgProxy: GET /api/img?url=... hanya untuk host gambar YouTube/Google. Dipakai bila gambar langsung gagal.
func ImgProxy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	u, err := url.Parse(r.URL.Query().Get("url"))
	ok := false
	if err == nil && (u.Scheme == "https" || u.Scheme == "http") {
		for _, s := range []string{"googleusercontent.com", "ggpht.com", "ytimg.com", "youtube.com"} {
			if u.Hostname() == s || strings.HasSuffix(u.Hostname(), "."+s) {
				ok = true
			}
		}
	}
	if !ok {
		http.Error(w, "url tidak diizinkan", http.StatusForbidden)
		return
	}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, u.String(), nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://music.youtube.com/")
	resp, err := ic.Do(req)
	if err != nil || resp.StatusCode != 200 {
		if resp != nil {
			resp.Body.Close()
		}
		http.Error(w, "gambar tidak tersedia", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Cache-Control", "public, max-age=86400")
	salin(w, resp, u)
}

// batasiRange mengubah "bytes=N-" (atau tanpa Range) menjadi "bytes=N-(N+max-1)".
// Range yang sudah punya ujung diperkecil bila lebih besar dari max.
func batasiRange(rg string, max int64) string {
	if rg == "" {
		return "bytes=0-" + strconv.FormatInt(max-1, 10)
	}
	if !strings.HasPrefix(rg, "bytes=") || strings.Contains(rg, ",") {
		return rg
	}
	a, b, ok := strings.Cut(strings.TrimPrefix(rg, "bytes="), "-")
	if !ok || a == "" { // "bytes=-N" (ambil N byte terakhir) biarkan apa adanya
		return rg
	}
	start, err := strconv.ParseInt(a, 10, 64)
	if err != nil {
		return rg
	}
	end := start + max - 1
	if b != "" {
		if e, err := strconv.ParseInt(b, 10, 64); err == nil && e < end {
			end = e
		}
	}
	return "bytes=" + strconv.FormatInt(start, 10) + "-" + strconv.FormatInt(end, 10)
}
