package handler

import (
	"context"
	"net/http"
	"strings"
	"time"

	"jelan-music/internal/ytmusic"
)

var _ = strings.TrimSpace

// GET /api/search
func Handler(w http.ResponseWriter, r *http.Request) {
	ytmusic.Serve(w, r, 600, 30*time.Second, func(ctx context.Context, r *http.Request) (any, error) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q == "" {
			return nil, ytmusic.BadReq("parameter q wajib")
		}
		return ytmusic.Engine().Search(ctx, q)
	})
}
