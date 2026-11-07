#!/bin/sh
# Jalankan Jemci di Termux:  sh jalankan.sh
cd "$(dirname "$0")" || exit 1
# matikan server lama (jika ada) supaya tidak bentrok
pkill -f "/exe/local" 2>/dev/null
# rapikan dependency otomatis kalau go.mod/go.sum belum lengkap
if [ ! -f go.sum ] || ! go list -deps ./local >/dev/null 2>&1; then
  echo "Menyiapkan dependency (go mod tidy)..."
  go mod tidy || { echo "go mod tidy gagal. Cek internet, atau jalankan: pkg install golang"; exit 1; }
fi
# baca key dari file .env (isi: DL_API_KEY=key_kamu)
if [ -f .env ]; then set -a; . ./.env; set +a; fi
echo "Folder: $(pwd)"
go run ./local
