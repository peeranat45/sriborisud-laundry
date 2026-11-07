#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  ตั้งค่าและรันโปรเจกต์ในเครื่อง · ตั้งแต่ศูนย์จนเปิดเว็บได้
#  ---------------------------------------------------------------
#    ./scripts/dev.sh            ตั้งค่า (ถ้ายังไม่เคย) แล้วรัน dev server
#    ./scripts/dev.sh setup      ตั้งค่าอย่างเดียว ไม่รัน server
#    ./scripts/dev.sh up         เปิดเฉพาะ Postgres
#    ./scripts/dev.sh down       ปิด Postgres · ข้อมูลยังอยู่
#    ./scripts/dev.sh reset      ลบฐานข้อมูลทิ้งแล้วสร้างใหม่ · ข้อมูลหายหมด
#    ./scripts/dev.sh psql       เปิด psql เข้าฐานข้อมูล
#    ./scripts/dev.sh check      ตรวจสถานะอย่างเดียว ไม่แก้อะไร
#
#  รันซ้ำได้เสมอ · ทุกขั้นเช็คก่อนว่าทำไปแล้วหรือยัง
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# ── ค่าที่ต้องตรงกับ docker-compose.yml ────────────────────────
PG_USER="${POSTGRES_USER:-sriborisud}"
PG_PASS="${POSTGRES_PASSWORD:-localdev}"
PG_DB="${POSTGRES_DB:-sriborisud}"
PG_PORT="${POSTGRES_PORT:-5433}"

LOCAL_DB_URL="postgresql://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}"

# ── สี ──────────────────────────────────────────────────────────
if [ -t 1 ]; then
  B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; D=$'\033[2m'; N=$'\033[0m'
else
  B=''; G=''; Y=''; R=''; D=''; N=''
fi
step()  { echo; echo "${B}▸ $*${N}"; }
ok()    { echo "  ${G}✓${N} $*"; }
warn()  { echo "  ${Y}!${N} $*"; }
die()   { echo "  ${R}✗${N} $*" >&2; exit 1; }
note()  { echo "  ${D}$*${N}"; }

# ── docker compose หรือ docker-compose ──────────────────────────
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  die "ไม่พบ docker compose · ติดตั้ง Docker Desktop ก่อน"
fi

# ═══════════════════════════════════════════════════════════════
check_prereqs() {
  step "ตรวจเครื่องมือที่ต้องมี"
  command -v node >/dev/null || die "ไม่พบ node"
  command -v npm  >/dev/null || die "ไม่พบ npm"
  docker info >/dev/null 2>&1 || die "Docker ไม่ได้รัน · เปิด Docker Desktop ก่อน"
  ok "node $(node -v) · npm $(npm -v) · docker พร้อม"
}

# ═══════════════════════════════════════════════════════════════
start_db() {
  step "เปิด Postgres"

  # เช็คพอร์ตชนก่อน · อาการ "ต่อฐานข้อมูลไม่ได้" ที่หาสาเหตุยากที่สุด
  # คือมี Postgres ตัวอื่นจองพอร์ตอยู่ แล้วเราไปต่อผิดตัวโดยไม่รู้
  if lsof -nP -iTCP:"${PG_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    if $DC ps --status running 2>/dev/null | grep -q postgres; then
      ok "container เปิดอยู่แล้วที่พอร์ต ${PG_PORT}"
    else
      warn "พอร์ต ${PG_PORT} ถูกโปรแกรมอื่นใช้อยู่ (อาจเป็น Postgres ที่ลงไว้ในเครื่อง)"
      note "ทางแก้ · ตั้ง POSTGRES_PORT=5434 แล้วแก้ DATABASE_URL ใน .env.local ให้ตรง"
      note "ดูว่าใครใช้อยู่ · lsof -nP -iTCP:${PG_PORT} -sTCP:LISTEN"
      die "พอร์ตชน"
    fi
  fi

  $DC up -d postgres

  printf "  รอ Postgres พร้อมรับการเชื่อมต่อ"
  for i in $(seq 1 40); do
    if $DC exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
      echo; ok "Postgres พร้อม · พอร์ต ${PG_PORT}"
      return 0
    fi
    printf "."
    sleep 1
  done
  echo
  $DC logs --tail=30 postgres
  die "Postgres ไม่พร้อมใน 40 วินาที · ดู log ข้างบน"
}

# ═══════════════════════════════════════════════════════════════
ensure_env() {
  step "ตรวจ .env.local"

  if [ ! -f .env.local ]; then
    cp .env.example .env.local
    ok "สร้าง .env.local จาก .env.example แล้ว"
  fi

  # ไม่แก้ไฟล์ให้เอง · ค่าที่อยู่ในนั้นอาจชี้ไป Supabase โดยตั้งใจ
  if grep -qE '^DATABASE_URL=.*localhost' .env.local; then
    ok "DATABASE_URL ชี้มาที่ Postgres ในเครื่องแล้ว"
  else
    warn "DATABASE_URL ไม่ได้ชี้มาที่ localhost"
    note "ถ้าต้องการใช้ Postgres ใน Docker ให้แก้ .env.local เป็น"
    echo
    echo "    DATABASE_URL=\"${LOCAL_DB_URL}\""
    echo "    DIRECT_URL=\"${LOCAL_DB_URL}\""
    echo
    note "(ของในเครื่องไม่ต้องใส่ ?pgbouncer=true · อันนั้นมีไว้สำหรับ Supabase pooler)"
    note "ถ้าตั้งใจใช้ Supabase อยู่แล้ว ข้ามข้อนี้ได้"
  fi

  # ── ตัวแปรที่ขาดไม่ได้ · เช็คชื่อและความว่าง ไม่พิมพ์ค่าออกมา ──
  local missing=()
  for key in DATABASE_URL DIRECT_URL NEXT_PUBLIC_LIFF_ID LINE_LOGIN_CHANNEL_ID BILL_TOKEN_SECRET; do
    grep -qE "^${key}=.+" .env.local || missing+=("$key")
  done

  if [ ${#missing[@]} -gt 0 ]; then
    warn "ยังไม่ได้ตั้งค่า: ${missing[*]}"
    for key in "${missing[@]}"; do
      case "$key" in
        LINE_LOGIN_CHANNEL_ID)
          note "LINE_LOGIN_CHANNEL_ID · Console → channel แบบ LINE Login → Basic settings → Channel ID"
          note "  (ตัวเลขล้วน · คนละตัวกับ LIFF ID และคนละตัวกับ access token)" ;;
        BILL_TOKEN_SECRET)
          note "BILL_TOKEN_SECRET · สร้างด้วย openssl rand -base64 48" ;;
        NEXT_PUBLIC_LIFF_ID)
          note "NEXT_PUBLIC_LIFF_ID · Console → LINE Login → LIFF → LIFF ID" ;;
      esac
    done
    note "หน้าเว็บจะเปิดได้ แต่ /link กับ /dev/qr จะยังทำงานไม่ครบ"
  else
    ok "ตัวแปรครบทุกตัว"
  fi
}

# ═══════════════════════════════════════════════════════════════
install_deps() {
  step "ติดตั้ง dependency"
  if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    npm install --no-audit --no-fund
    ok "ติดตั้งเรียบร้อย"
  else
    ok "node_modules เป็นปัจจุบันแล้ว"
  fi
}

# ═══════════════════════════════════════════════════════════════
run_migrations() {
  step "ฐานข้อมูล · schema"
  export DATABASE_URL DIRECT_URL
  set -a; [ -f .env.local ] && . ./.env.local; set +a

  npx prisma generate >/dev/null
  ok "สร้าง Prisma client แล้ว"

  if [ ! -d prisma/migrations ]; then
    note "ยังไม่มี migration · กำลังสร้างชุดแรก"
    npx prisma migrate dev --name init
    ok "สร้างตารางเรียบร้อย"
  else
    npx prisma migrate deploy
    ok "migration ทั้งหมดถูก apply แล้ว"
  fi
}

# ═══════════════════════════════════════════════════════════════
seed_data() {
  step "ใส่ข้อมูลตัวอย่าง"
  set -a; [ -f .env.local ] && . ./.env.local; set +a
  npm run db:seed
}

# ═══════════════════════════════════════════════════════════════
show_next() {
  cat <<EOF

${B}พร้อมแล้ว${N}

  ${B}หน้าร้าน${N}        http://localhost:3000/
  ${B}QR ทดสอบ${N}        http://localhost:3000/dev/qr
  ${B}ดูฐานข้อมูล${N}      npm run db:studio

${B}ทดสอบ LIFF บนมือถือ${N}
  LINE ต้องเข้าถึง endpoint จากภายนอก จึงต้องมี tunnel

    1  ${D}npx ngrok http 3000${N}
    2  เอา URL https://... ไปใส่ใน LIFF app → Endpoint URL
       ต่อท้ายด้วย /link  →  https://xxxx.ngrok-free.app/link
    3  เปิด /dev/qr บนคอม แล้วสแกน QR ด้วยมือถือ

${B}คำสั่งที่ใช้บ่อย${N}
  ${D}./scripts/dev.sh down${N}     ปิด Postgres · ${G}ข้อมูลยังอยู่${N}
  ${D}./scripts/dev.sh reset${N}    ลบฐานข้อมูลทิ้งสร้างใหม่ · ${R}ข้อมูลหายหมด${N}
  ${D}./scripts/dev.sh psql${N}     เปิด psql

EOF
}

# ═══════════════════════════════════════════════════════════════
cmd_setup() {
  check_prereqs
  start_db
  ensure_env
  install_deps
  run_migrations
  seed_data
}

case "${1:-dev}" in
  dev)
    cmd_setup
    show_next
    step "เปิด dev server"
    exec npm run dev
    ;;

  setup)
    cmd_setup
    show_next
    ;;

  up)
    check_prereqs
    start_db
    ;;

  down)
    step "ปิด Postgres"
    $DC down
    ok "ปิดแล้ว · ${G}ข้อมูลยังอยู่ใน volume sriborisud-pgdata${N}"
    note "ถ้าต้องการลบข้อมูลด้วย ใช้ ./scripts/dev.sh reset"
    ;;

  reset)
    echo
    echo "${R}${B}คำสั่งนี้จะลบฐานข้อมูลทั้งหมดทิ้ง${N}"
    echo "volume sriborisud-pgdata จะถูกลบ · ข้อมูลทุกอย่างหายถาวร"
    read -r -p "พิมพ์ reset เพื่อยืนยัน: " answer
    [ "$answer" = "reset" ] || { echo "ยกเลิก"; exit 0; }
    $DC down -v
    ok "ลบ volume แล้ว"
    cmd_setup
    ok "สร้างใหม่เรียบร้อย"
    ;;

  psql)
    exec $DC exec postgres psql -U "$PG_USER" -d "$PG_DB"
    ;;

  check)
    check_prereqs
    step "สถานะ container"
    $DC ps
    step "volume"
    docker volume ls --filter name=sriborisud-pgdata
    ensure_env
    ;;

  *)
    sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
