// Server lokal untuk tes (Termux/PC). Di Vercel file ini tidak dipakai.
// Jalankan dari root proyek: go run ./local
package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"jelan-music/internal/ytmusic"
)

type fn func(ctx context.Context, r *http.Request) (any, error)

func need(r *http.Request, k string) (string, error) {
	v := strings.TrimSpace(r.URL.Query().Get(k))
	if v == "" {
		return "", ytmusic.BadReq("parameter " + k + " wajib")
	}
	return v, nil
}

func route(mux *http.ServeMux, path string, cache int, to time.Duration, f fn) {
	mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		ytmusic.Serve(w, r, cache, to, f)
	})
}

func main() {
	e := ytmusic.Engine()
	mux := http.NewServeMux()
	route(mux, "/api/search", 600, 30*time.Second, func(c context.Context, r *http.Request) (any, error) {
		q, err := need(r, "q")
		if err != nil {
			return nil, err
		}
		return e.Search(c, q)
	})
	route(mux, "/api/play", 3600, 30*time.Second, func(c context.Context, r *http.Request) (any, error) {
		id, err := need(r, "id")
		if err != nil {
			return nil, err
		}
		return e.PlayMeta(c, id)
	})
	route(mux, "/api/stream", 900, 55*time.Second, func(c context.Context, r *http.Request) (any, error) {
		id, err := need(r, "id")
		if err != nil {
			return nil, err
		}
		return e.Stream(c, id, r.URL.Query().Get("format"))
	})
	route(mux, "/api/dl", 0, 58*time.Second, func(c context.Context, r *http.Request) (any, error) {
		id, err := need(r, "id")
		if err != nil {
			return nil, err
		}
		return e.Download(c, id, r.URL.Query().Get("format"))
	})
	route(mux, "/api/album", 1800, 30*time.Second, func(c context.Context, r *http.Request) (any, error) {
		id, err := need(r, "id")
		if err != nil {
			return nil, err
		}
		return e.Album(c, id)
	})
	route(mux, "/api/playlist", 1800, 30*time.Second, func(c context.Context, r *http.Request) (any, error) {
		id, err := need(r, "id")
		if err != nil {
			return nil, err
		}
		return e.Playlist(c, id)
	})
	mux.HandleFunc("/api/proxy", ytmusic.Proxy)
	mux.HandleFunc("/api/img", ytmusic.ImgProxy)
	// Cari folder proyek (yang berisi index.html) dari folder saat ini, naik maksimal 3 tingkat.
	root := "."
	for i := 0; i < 4; i++ {
		if _, err := os.Stat(root + "/index.html"); err == nil {
			break
		}
		root += "/.."
	}
	if _, err := os.Stat(root + "/index.html"); err != nil {
		log.Fatal("index.html tidak ditemukan. Jalankan dari folder jelan-music: cd ~/jelan-music && go run ./local")
	}
	abs, _ := filepath.Abs(root)
	log.Println("Menyajikan file dari:", abs)
	fs := http.FileServer(http.Dir(root))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, root+"/index.html")
			return
		}
		fs.ServeHTTP(w, r)
	})

	if os.Getenv("DL_API_KEY") == "" {
		log.Println("PERINGATAN: DL_API_KEY kosong. Pencarian jalan, tapi lagu tidak bisa diputar.")
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	// Kalau port dipakai (misalnya server lama masih hidup), otomatis coba port berikutnya.
	p, _ := strconv.Atoi(port)
	var ln net.Listener
	var err error
	for i := 0; i < 10; i++ {
		ln, err = net.Listen("tcp", ":"+strconv.Itoa(p+i))
		if err == nil {
			port = strconv.Itoa(p + i)
			break
		}
	}
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Jemci jalan di http://localhost:" + port)
	log.Fatal(http.Serve(ln, mux))
}
