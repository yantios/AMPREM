#!/bin/sh
# Jalankan Jemci di Termux/PC:  sh jalankan.sh
cd "$(dirname "$0")" || exit 1
pkill -x jemci 2>/dev/null
if [ ! -f go.sum ] || ! go list -deps . >/dev/null 2>&1; then
  echo "Menyiapkan dependency (go mod tidy)..."
  go mod tidy || { echo "go mod tidy gagal. Cek internet, atau jalankan: pkg install golang"; exit 1; }
fi
# baca key dari file .env (isi: DL_API_KEY=key_kamu)
if [ -f .env ]; then set -a; . ./.env; set +a; fi
echo "Folder: $(pwd)"
go build -o jemci . && ./jemci
