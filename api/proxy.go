package handler

import (
	"net/http"

	"jelan-music/internal/ytmusic"
)

// GET /api/proxy?url=... : meneruskan audio (mendukung Range).
func Handler(w http.ResponseWriter, r *http.Request) { ytmusic.Proxy(w, r) }
