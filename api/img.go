package handler

import (
	"net/http"

	"jelan-music/internal/ytmusic"
)

// GET /api/img?url=... : proxy gambar cover (hanya host YouTube/Google).
func Handler(w http.ResponseWriter, r *http.Request) { ytmusic.ImgProxy(w, r) }
