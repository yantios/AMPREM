package ytmusic

// Helper HTTP: CORS, rate limit per IP, cache singkat in-memory, timeout, format ExtractionResult.

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// BadReq = error karena parameter salah (HTTP 400).
type BadReq string

func (b BadReq) Error() string { return string(b) }

type bucket struct {
	n     int
	reset time.Time
}
type entry struct {
	b   []byte
	exp time.Time
}

var (
	once  sync.Once
	eng   *YTMusicEngine
	rlMu  sync.Mutex
	rl    = map[string]*bucket{}
	cMu   sync.Mutex
	cache = map[string]entry{}
	fMu   sync.Mutex
	fl    = map[string]*flight{}
)

// flight = satu permintaan yang sedang berjalan. Permintaan identik (mis. prefetch + klik putar
// untuk lagu yang sama) menunggu hasil yang sama, tidak memulai konversi kedua.
type flight struct {
	done chan struct{}
	data any
	err  error
}

// Engine = instance tunggal, dipakai ulang selama server hidup.
func Engine() *YTMusicEngine {
	once.Do(func() { eng, _ = NewYTMusicEngine(40 * time.Second) })
	return eng
}

func allow(ip string) bool {
	rlMu.Lock()
	defer rlMu.Unlock()
	now := time.Now()
	if len(rl) > 5000 { // server jalan terus: buang bucket kedaluwarsa supaya memori tidak membengkak
		for k, v := range rl {
			if now.After(v.reset) {
				delete(rl, k)
			}
		}
	}
	b := rl[ip]
	if b == nil || now.After(b.reset) {
		b = &bucket{reset: now.Add(time.Minute)}
		rl[ip] = b
	}
	b.n++
	return b.n <= 240 // 240 request / menit / IP
}

func writeJSON(w http.ResponseWriter, status int, res ExtractionResult, cc string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if cc != "" {
		w.Header().Set("Cache-Control", cc)
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(res)
}

// Serve membungkus satu handler: CORS, rate limit, cache, timeout, format JSON seragam.
func Serve(w http.ResponseWriter, r *http.Request, cacheSec int, timeout time.Duration,
	fn func(ctx context.Context, r *http.Request) (any, error)) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Range")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	ip := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0])
	if ip == "" {
		ip = r.RemoteAddr
	}
	if !allow(ip) {
		writeJSON(w, 429, ExtractionResult{StatusCode: 429, Timestamp: time.Now().UnixMilli(),
			Error: &ErrorDetail{Code: "RATE_LIMITED", Message: "Terlalu banyak request, coba lagi sebentar."}}, "")
		return
	}
	key := r.URL.RequestURI()
	if cacheSec > 0 {
		cMu.Lock()
		e, ok := cache[key]
		cMu.Unlock()
		if ok && time.Now().Before(e.exp) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Write(e.b)
			return
		}
	}
	var data any
	var err error
	fMu.Lock()
	if f, ok := fl[key]; ok && cacheSec > 0 {
		fMu.Unlock()
		select {
		case <-f.done:
			data, err = f.data, f.err
		case <-r.Context().Done():
			return
		}
	} else {
		f = &flight{done: make(chan struct{})}
		if cacheSec > 0 {
			fl[key] = f
		}
		fMu.Unlock()
		// konteks dipisah dari request supaya prefetch yang dibatalkan browser tidak menggagalkan peminta lain
		base := context.Background()
		if cacheSec == 0 {
			base = r.Context()
		}
		ctx, cancel := context.WithTimeout(base, timeout)
		data, err = fn(ctx, r)
		cancel()
		f.data, f.err = data, err
		close(f.done)
		fMu.Lock()
		delete(fl, key)
		fMu.Unlock()
	}
	if err != nil {
		st := 502
		var bad BadReq
		if errors.As(err, &bad) {
			st = 400
		}
		writeJSON(w, st, ExtractionResult{StatusCode: st, Timestamp: time.Now().UnixMilli(),
			Error: &ErrorDetail{Code: "EXTRACTION_FAILED", Message: err.Error()}}, "no-store")
		return
	}
	res := ExtractionResult{Success: true, StatusCode: 200, Data: data, Timestamp: time.Now().UnixMilli()}
	cc := ""
	if cacheSec > 0 {
		cc = "public, s-maxage=" + strconv.Itoa(cacheSec) + ", stale-while-revalidate=60"
		b, _ := json.Marshal(res)
		cMu.Lock()
		if len(cache) > 300 {
			cache = map[string]entry{}
		}
		cache[key] = entry{b, time.Now().Add(time.Duration(cacheSec) * time.Second)}
		cMu.Unlock()
	}
	writeJSON(w, 200, res, cc)
}

// AllowedHost: bila env PROXY_ALLOW kosong semua host publik boleh; bila diisi (pisah koma) hanya domain itu.
func AllowedHost(h string) bool {
	list := getenv("PROXY_ALLOW", "")
	if list == "" {
		return true
	}
	for _, s := range strings.Split(list, ",") {
		s = strings.TrimSpace(s)
		if s != "" && (h == s || strings.HasSuffix(h, "."+s)) {
			return true
		}
	}
	return false
}
