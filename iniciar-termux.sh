#!/data/data/com.termux/files/usr/bin/bash
set -e
cd -- "$(dirname -- "$0")"
case "${1:-}" in
  --install)
    pkg update
    pkg install -y nodejs-lts ffmpeg
    npm ci --omit=optional
    ;;
  --pm2|'') ;;
  *) echo 'Uso: bash iniciar-termux.sh [--install | --pm2]'; exit 1 ;;
esac
if ! command -v node >/dev/null || ! node -e 'require("node:sqlite")' >/dev/null 2>&1; then
  echo 'Instala Node.js 24 o superior con pkg install nodejs-lts.'
  exit 1
fi
if ! command -v ffmpeg >/dev/null; then
  echo 'Instala FFmpeg con pkg install ffmpeg.'
  exit 1
fi
if [[ ! -d node_modules/@whiskeysockets/baileys ]]; then
  npm ci --omit=optional
fi
linked=false
if node -e 'try {process.exit(require("./sesion/creds.json").registered === true ? 0 : 1)} catch {process.exit(1)}'; then
  linked=true
fi
if [[ "${1:-}" == --pm2 && "$linked" == false ]]; then
  echo 'Primero ejecuta bash iniciar-termux.sh y vincula WhatsApp con A o B.'
  exit 1
fi
if [[ -z "${BOT_OWNER_PHONE:-}" ]]; then
  read -r -p 'Tu número de dueño con código de país, sin espacios: ' BOT_OWNER_PHONE
  export BOT_OWNER_PHONE
fi
if [[ "${1:-}" == --pm2 ]]; then
  if [[ ! "${BOT_OWNER_PHONE#+}" =~ ^[1-9][0-9]{6,14}$ ]]; then
    echo 'Escribe un número de dueño con código de país y sin espacios.'
    exit 1
  fi
  if ! command -v pm2 >/dev/null; then
    npm install -g pm2
  fi
  termux-wake-lock
  if pm2 describe bot-premium >/dev/null 2>&1; then
    pm2 restart bot-premium --update-env
  else
    pm2 start "$PWD/index.mjs" --name bot-premium --cwd "$PWD" --interpreter "$(command -v node)" --restart-delay 3000
  fi
  pm2 save
  exit 0
fi
if [[ "$linked" == false ]]; then
  printf '\nMétodo de vinculación de WhatsApp\nA) Código QR\nB) Código de 8 caracteres\n'
  while true; do
    read -r -p 'Elige A o B: ' choice
    case "$choice" in
      A|a)
        unset BOT_PAIR_PHONE
        echo 'Escanea el QR desde WhatsApp → Dispositivos vinculados → Vincular un dispositivo.'
        break
        ;;
      B|b)
        if [[ -z "${BOT_PAIR_PHONE:-}" ]]; then
          read -r -p 'Número del WhatsApp que vas a vincular (Enter para usar el número del dueño): ' BOT_PAIR_PHONE
          BOT_PAIR_PHONE="${BOT_PAIR_PHONE:-$BOT_OWNER_PHONE}"
        fi
        export BOT_PAIR_PHONE
        break
        ;;
      *) echo 'Escribe A para QR o B para código.' ;;
    esac
  done
fi
exec node index.mjs
