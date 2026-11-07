package handler

import (
	"context"
	"net/http"
	"strings"
	"time"

	"jelan-music/internal/ytmusic"
)

var _ = strings.TrimSpace

// GET /api/stream
func Handler(w http.ResponseWriter, r *http.Request) {
	ytmusic.Serve(w, r, 900, 55*time.Second, func(ctx context.Context, r *http.Request) (any, error) {
		id := strings.TrimSpace(r.URL.Query().Get("id"))
		if id == "" {
			return nil, ytmusic.BadReq("parameter id wajib")
		}
		return ytmusic.Engine().Stream(ctx, id, r.URL.Query().Get("format"))
	})
}
