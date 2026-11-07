# --- build ---
FROM golang:1.22-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOFLAGS=-mod=mod
COPY . .
# go.sum dibuat otomatis saat build, jadi tidak perlu dikirim
RUN go mod tidy && go build -trimpath -ldflags="-s -w" -o /out/jemci .

# --- run ---
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/jemci /app/jemci
COPY public /app/public
ENV STATIC_DIR=/app/public
# Railway mengisi PORT otomatis
EXPOSE 8080
CMD ["/app/jemci"]
