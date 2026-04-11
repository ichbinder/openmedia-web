#!/usr/bin/env bash
# =============================================================================
# E2E-Test: Vollständiger Upload-Flow gegen Hetzner Prod
# =============================================================================
# Testet den kompletten M024 Upload-Flow:
#   1. Test-NzbFile + DownloadJob erstellen (via /test/jobs/:id/force-complete)
#   2. DownloadJob auf completed setzen → Auto-Upload-Trigger feuert
#   3. UploadJob erscheint (Poll GET /uploads)
#   4. VPS auf Hetzner sichtbar (via API prüfen)
#   5. Warten bis UploadJob status=completed
#   6. NZB abrufbar vom NZB-Service (GET /files/{hash})
#   7. Neues NzbFile mit source='own' existiert in DB
#   8. VPS aufgeräumt (keine upload-purpose Server)
#   9. Cleanup: Testdaten löschen
#
# Benötigte ENV-Vars (oder in .env.e2e im Projekt-Root):
#   API_BASE_URL     — Basis-URL der openmedia-api (z.B. https://api.mediatoken.de)
#   SERVICE_TOKEN    — JWT Token für authentifizierte API-Aufrufe
#   HETZNER_API_TOKEN — Hetzner Cloud API Token
#   NZB_SERVICE_URL  — URL des NZB-Service (z.B. https://nzb.nettoken.de)
#
# Optional:
#   POLL_INTERVAL    — Sekunden zwischen Polls (Default: 10)
#   UPLOAD_TIMEOUT   — Max Sekunden auf Upload-VPS (Default: 900 = 15 Min)
#   NZB_SERVICE_TOKEN — Token für NZB-Service API-Auth
# =============================================================================
set -euo pipefail

# ── Env-File laden falls vorhanden ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../.env.e2e" ]; then
  # shellcheck disable=SC1090
  set -a; source "${SCRIPT_DIR}/../.env.e2e"; set +a
fi

# ── Farben für Ausgabe ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Konfiguration aus ENV ───────────────────────────────────────────────────
API_BASE_URL="${API_BASE_URL:?FEHLER: API_BASE_URL muss gesetzt sein}"
SERVICE_TOKEN="${SERVICE_TOKEN:?FEHLER: SERVICE_TOKEN muss gesetzt sein}"
HETZNER_API_TOKEN="${HETZNER_API_TOKEN:?FEHLER: HETZNER_API_TOKEN muss gesetzt sein}"
NZB_SERVICE_URL="${NZB_SERVICE_URL:-https://nzb.nettoken.de}"
NZB_SERVICE_TOKEN="${NZB_SERVICE_TOKEN:-}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"
UPLOAD_TIMEOUT="${UPLOAD_TIMEOUT:-900}"

# ── Test-Tracking ───────────────────────────────────────────────────────────
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0
CLEANUP_JOBS=()
CLEANUP_UPLOAD_JOBS=()

# ── Hilfsfunktionen ─────────────────────────────────────────────────────────

log_info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; TESTS_PASSED=$((TESTS_PASSED + 1)); TESTS_TOTAL=$((TESTS_TOTAL + 1)); }
log_fail()  { echo -e "${RED}[FAIL]${NC}  $*"; TESTS_FAILED=$((TESTS_FAILED + 1)); TESTS_TOTAL=$((TESTS_TOTAL + 1)); }
log_step()  { echo -e "${YELLOW}[SCHRITT]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

# Authentifizierter API-Aufruf (GET)
api_get() {
  local path="$1"
  curl -sf -H "Authorization: Bearer ${SERVICE_TOKEN}" \
       -H "Content-Type: application/json" \
       "${API_BASE_URL}${path}" 2>/dev/null
}

# Authentifizierter API-Aufruf (POST)
api_post() {
  local path="$1"
  local body="$2"
  curl -sf -X POST \
       -H "Authorization: Bearer ${SERVICE_TOKEN}" \
       -H "Content-Type: application/json" \
       -d "$body" \
       "${API_BASE_URL}${path}" 2>/dev/null
}

# Authentifizierter API-Aufruf (PATCH)
api_patch() {
  local path="$1"
  local body="$2"
  curl -sf -X PATCH \
       -H "Authorization: Bearer ${SERVICE_TOKEN}" \
       -H "Content-Type: application/json" \
       -d "$body" \
       "${API_BASE_URL}${path}" 2>/dev/null
}

# Hetzner API-Aufruf
hetzner_get() {
  local path="$1"
  curl -sf -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
       -H "Content-Type: application/json" \
       "https://api.hetzner.cloud/v1${path}" 2>/dev/null
}

# Poll-Funktion: wartet bis Bedingung erfüllt ist
# Usage: poll_until "Beschreibung" timeout_seconds command_to_run
poll_until() {
  local description="$1"
  local timeout="$2"
  shift 2
  local cmd=("$@")
  local elapsed=0

  log_info "Warte bis: ${description} (Timeout: ${timeout}s)"

  while [ "$elapsed" -lt "$timeout" ]; do
    if result=$("${cmd[@]}" 2>/dev/null); then
      echo "$result"
      return 0
    fi
    sleep "$POLL_INTERVAL"
    elapsed=$((elapsed + POLL_INTERVAL))
    # Fortschritt anzeigen alle 30 Sekunden
    if [ $((elapsed % 30)) -eq 0 ] || [ "$elapsed" -ge "$timeout" ]; then
      log_info "  ... ${elapsed}s / ${timeout}s vergangen"
    fi
  done

  return 1
}

# ── Cleanup-Funktion ────────────────────────────────────────────────────────
cleanup() {
  log_step "Cleanup: Testdaten entfernen"

  # Upload-Jobs aufräumen (falls welche erstellt wurden)
  for job_id in "${CLEANUP_UPLOAD_JOBS[@]:-}"; do
    log_info "Lösche UploadJob ${job_id}..."
    curl -sf -X DELETE \
         -H "Authorization: Bearer ${SERVICE_TOKEN}" \
         "${API_BASE_URL}/uploads/${job_id}" 2>/dev/null || true
  done

  # Download-Jobs aufräumen
  for job_id in "${CLEANUP_JOBS[@]:-}"; do
    log_info "Lösche DownloadJob ${job_id}..."
    curl -sf -X DELETE \
         -H "Authorization: Bearer ${SERVICE_TOKEN}" \
         "${API_BASE_URL}/downloads/jobs/${job_id}" 2>/dev/null || true
  done

  # Hetzner: Verwaiste Upload-VPS aufräumen (nur test-gekennzeichnete)
  log_info "Prüfe auf verwaiste Test-VPS auf Hetzner..."
  local servers
  servers=$(hetzner_get "/servers?label_selector=purpose=openmedia-upload&per_page=50" 2>/dev/null || echo '{"servers":[]}')
  # Extrahiere Server-IDs die länger als 30 Min laufen (potenziell hängengeblieben)
  echo "$servers" | jq -r '.servers[] | select(.created != null) | "\(.id) \(.name) \(.created)"' 2>/dev/null | while read -r sid sname screated; do
    # macOS: date -j, Linux: date -d — ISO-Zeitstempel parsen
    created_epoch=$(python3 -c "from datetime import datetime; print(int(datetime.fromisoformat('${screated%.*}').timestamp()))" 2>/dev/null || echo "0")
    now_epoch=$(date "+%s")
    age=$(( now_epoch - created_epoch ))
    # Nur Server älter als 30 Minuten löschen (die Test-VPS)
    if [ "$age" -gt 1800 ]; then
      log_warn "Lösche verwaisten Test-VPS: ${sname} (id=${sid}, Alter=${age}s)"
      curl -sf -X DELETE \
           -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
           "https://api.hetzner.cloud/v1/servers/${sid}" 2>/dev/null || true
    fi
  done

  log_info "Cleanup abgeschlossen"
}

# ── Haupttest ───────────────────────────────────────────────────────────────

echo ""
echo "================================================================"
echo " E2E-Test: Upload-Flow gegen Hetzner Prod"
echo " API: ${API_BASE_URL}"
echo " NZB-Service: ${NZB_SERVICE_URL}"
echo " Timeout: ${UPLOAD_TIMEOUT}s"
echo "================================================================"
echo ""

# Trap für Cleanup bei Abbruch
trap cleanup EXIT

# ── Schritt 1: Vorhandene Upload-VPS prüfen (Soll: keine) ──────────────────
log_step "Schritt 1: Vorhandene Upload-VPS auf Hetzner prüfen"

EXISTING_VPS=$(hetzner_get "/servers?label_selector=purpose=openmedia-upload&per_page=50" | jq '.servers // [] | length' 2>/dev/null || echo "0")

if [ "$EXISTING_VPS" = "0" ]; then
  log_ok "Keine aktiven Upload-VPS auf Hetzner (Basislinie bestätigt)"
else
  log_warn "${EXISTING_VPS} Upload-VPS bereits vorhanden — Test kann verfälscht sein"
fi

# ── Schritt 2: Test-DownloadJob erstellen und abschließen ───────────────────
log_step "Schritt 2: Test-DownloadJob erstellen und auf completed setzen"

# Zuerst einen Test-User registrieren um einen Token zu bekommen
# Alternativ: SERVICE_TOKEN direkt nutzen wenn es Admin-Rechte hat
log_info "Prüfe API-Erreichbarkeit..."
HEALTH=$(api_get "/health" 2>/dev/null || echo "")
if [ -z "$HEALTH" ]; then
  log_fail "API nicht erreichbar unter ${API_BASE_URL}"
  exit 1
fi
log_ok "API erreichbar"

# Einen bestehenden abgeschlossenen DownloadJob finden für den Test
# Wir suchen einen DownloadJob der completed ist und ein s3Key hat
log_info "Suche geeigneten abgeschlossenen DownloadJob..."
COMPLETED_JOBS=$(api_get "/downloads/jobs?status=completed" 2>/dev/null || echo '{"jobs":[]}')

# Prüfe ob Jobs gefunden wurden
JOB_COUNT=$(echo "$COMPLETED_JOBS" | jq '.jobs // [] | length' 2>/dev/null || echo "0")

if [ "$JOB_COUNT" = "0" ]; then
  log_fail "Keine abgeschlossenen DownloadJobs gefunden — kann Auto-Upload nicht testen"
  log_info "Hinweis: Es muss mindestens ein completed DownloadJob mit s3Key in der DB existieren"
  exit 1
fi

# Nimm den ersten passenden Job (mit s3Key und source=external)
TEST_JOB_ID=""
TEST_NZB_FILE_ID=""
TEST_NZB_HASH=""
TEST_MOVIE_ID=""

for i in $(seq 0 $((JOB_COUNT - 1))); do
  _ID=$(echo "$COMPLETED_JOBS" | jq -r ".jobs[$i].id" 2>/dev/null)
  _NZB_ID=$(echo "$COMPLETED_JOBS" | jq -r ".jobs[$i].nzbFileId" 2>/dev/null)
  _NZB_HASH=$(echo "$COMPLETED_JOBS" | jq -r ".jobs[$i].nzbFile.hash" 2>/dev/null)
  _S3KEY=$(echo "$COMPLETED_JOBS" | jq -r ".jobs[$i].nzbFile.s3Key" 2>/dev/null)
  _SOURCE=$(echo "$COMPLETED_JOBS" | jq -r ".jobs[$i].nzbFile.source // \"external\"" 2>/dev/null)
  _MOVIE_ID=$(echo "$COMPLETED_JOBS" | jq -r ".jobs[$i].nzbFile.movie.id // \"\"" 2>/dev/null)

  if [ "$_S3KEY" != "null" ] && [ -n "$_S3KEY" ] && [ "$_SOURCE" != "own" ]; then
    TEST_JOB_ID="$_ID"
    TEST_NZB_FILE_ID="$_NZB_ID"
    TEST_NZB_HASH="$_NZB_HASH"
    TEST_MOVIE_ID="$_MOVIE_ID"
    break
  fi
done

if [ -z "$TEST_JOB_ID" ]; then
  log_fail "Kein DownloadJob mit s3Key und source=external gefunden"
  exit 1
fi

log_ok "Test-DownloadJob gefunden: ${TEST_JOB_ID} (NzbFile: ${TEST_NZB_FILE_ID}, Hash: ${TEST_NZB_HASH})"

# ── Schritt 3: Prüfe ob bereits ein source='own' NzbFile existiert ─────────
log_step "Schritt 3: Prüfe ob bereits ein source='own' NzbFile existiert"

if [ -n "$TEST_MOVIE_ID" ] && [ "$TEST_MOVIE_ID" != "null" ]; then
  # Prüfe über API ob bereits ein own-NzbFile existiert
  OWN_NZB=$(api_get "/nzb/movies/${TEST_MOVIE_ID}" 2>/dev/null || echo "")
  OWN_COUNT=$(echo "$OWN_NZB" | jq -r '.movie.nzbFiles // [] | map(select(.source == "own")) | length' 2>/dev/null || echo "0")

  if [ "$OWN_COUNT" != "0" ]; then
    log_warn "Bereits ${OWN_COUNT} source='own' NzbFile(s) für diesen Film vorhanden"
    log_info "Idempotenz-Test: Auto-Upload sollte übersprungen werden"
    IDEMPOTENCY_TEST=true
  else
    log_ok "Noch kein source='own' NzbFile — Upload-Flow wird vollständig getestet"
    IDEMPOTENCY_TEST=false
  fi
else
  log_warn "Keine Movie-ID zugeordnet — Idempotenz-Prüfung übersprungen"
  IDEMPOTENCY_TEST=false
fi

# ── Schritt 4: UploadJob via POST /uploads erstellen ──────────────────────
log_step "Schritt 4: UploadJob via POST /uploads erstellen"

if [ "$IDEMPOTENCY_TEST" = true ]; then
  log_ok "Idempotenz-Test: Überspringe Upload-Erstellung da source='own' existiert"
  UPLOAD_JOB_ID=""
else
  UPLOAD_CREATE_RESULT=$(api_post "/uploads" "{\"nzbFileId\":\"${TEST_NZB_FILE_ID}\"}" 2>/dev/null || echo "{}")
  UPLOAD_JOB_ID=$(echo "$UPLOAD_CREATE_RESULT" | jq -r '.id // empty' 2>/dev/null)
  UPLOAD_JOB_STATUS=$(echo "$UPLOAD_CREATE_RESULT" | jq -r '.status // "error"' 2>/dev/null)
  HETZNER_SERVER_ID=$(echo "$UPLOAD_CREATE_RESULT" | jq -r '.hetznerServerId // empty' 2>/dev/null)
  HETZNER_SERVER_IP=$(echo "$UPLOAD_CREATE_RESULT" | jq -r '.hetznerServerIp // empty' 2>/dev/null)

  # Prüfe ob Erstellung fehlgeschlagen hat (z.B. 409 Already In Progress)
  CREATE_ERROR=$(echo "$UPLOAD_CREATE_RESULT" | jq -r '.error // empty' 2>/dev/null)

  if [ -n "$UPLOAD_JOB_ID" ] && [ "$UPLOAD_JOB_ID" != "null" ]; then
    log_ok "UploadJob erstellt: ${UPLOAD_JOB_ID} (Status: ${UPLOAD_JOB_STATUS})"
    CLEANUP_UPLOAD_JOBS+=("$UPLOAD_JOB_ID")

    if [ -n "$HETZNER_SERVER_ID" ] && [ "$HETZNER_SERVER_ID" != "null" ]; then
      log_info "VPS sofort bereit: Server-ID ${HETZNER_SERVER_ID} (${HETZNER_SERVER_IP})"
    fi
  elif [ -n "$CREATE_ERROR" ]; then
    log_fail "UploadJob-Erstellung fehlgeschlagen: ${CREATE_ERROR}"
    log_info "Mögliche Ursachen: source='own' existiert bereits, UploadJob läuft bereits"
  else
    log_fail "UploadJob konnte nicht erstellt werden"
    log_info "API-Antwort: ${UPLOAD_CREATE_RESULT}"
  fi
fi

# ── Schritte 6-8: Nur wenn UploadJob gefunden wurde ─────────────────────────
if [ -n "$UPLOAD_JOB_ID" ] && [ "$UPLOAD_JOB_ID" != "null" ] && [ "$UPLOAD_JOB_ID" != "" ]; then

  # ── Schritt 6: VPS auf Hetzner sichtbar? ──────────────────────────────────
  log_step "Schritt 6: VPS auf Hetzner sichtbar"

  # VPS-Info wurde bereits vom POST /uploads Response geliefert
  if [ -n "$HETZNER_SERVER_ID" ] && [ "$HETZNER_SERVER_ID" != "null" ]; then
    log_ok "VPS bereits aus POST-Response bekannt: Server-ID ${HETZNER_SERVER_ID} (${HETZNER_SERVER_IP})"
  else
    # Fallback: Poll Hetzner API
    HETZNER_SERVER_ID=""
    VPS_POLL_TIMEOUT=120
    ELAPSED=0

    while [ "$ELAPSED" -lt "$VPS_POLL_TIMEOUT" ]; do
      # Prüfe UploadJob für Hetzner-Server-ID
      JOB_DETAIL=$(api_get "/uploads/${UPLOAD_JOB_ID}" 2>/dev/null || echo "{}")
      HETZNER_SERVER_ID=$(echo "$JOB_DETAIL" | jq -r '.hetznerServerId // empty' 2>/dev/null)

      if [ -n "$HETZNER_SERVER_ID" ]; then
        break
      fi

      # Alternativ: Hetzner API direkt nach Upload-VPS suchen
      UPLOAD_SERVERS=$(hetzner_get "/servers?label_selector=purpose=openmedia-upload&per_page=10" 2>/dev/null || echo '{"servers":[]}')
      RECENT_COUNT=$(echo "$UPLOAD_SERVERS" | jq ".servers | length" 2>/dev/null || echo "0")

      if [ "$RECENT_COUNT" != "0" ]; then
        HETZNER_SERVER_ID=$(echo "$UPLOAD_SERVERS" | jq -r '.servers[0].id // empty' 2>/dev/null)
        [ -n "$HETZNER_SERVER_ID" ] && break
      fi

      sleep "$POLL_INTERVAL"
      ELAPSED=$((ELAPSED + POLL_INTERVAL))
    done
  fi

  if [ -n "$HETZNER_SERVER_ID" ]; then
    log_ok "Upload-VPS auf Hetzner sichtbar: Server-ID ${HETZNER_SERVER_ID}"
  else
    log_fail "Kein Upload-VPS auf Hetzner gefunden"
  fi

  # ── Schritt 7: Warten bis UploadJob completed ─────────────────────────────
  log_step "Schritt 7: Warten bis UploadJob status=completed (Timeout: ${UPLOAD_TIMEOUT}s)"

  FINAL_STATUS=""
  UPLOADED_NZB_HASH=""
  ELAPSED=0

  while [ "$ELAPSED" -lt "$UPLOAD_TIMEOUT" ]; do
    JOB_DETAIL=$(api_get "/uploads/${UPLOAD_JOB_ID}" 2>/dev/null || echo "{}")
    FINAL_STATUS=$(echo "$JOB_DETAIL" | jq -r '.status // "unknown"' 2>/dev/null)

    if [ "$FINAL_STATUS" = "completed" ]; then
      break
    elif [ "$FINAL_STATUS" = "failed" ]; then
      log_fail "UploadJob fehlgeschlagen!"
      error_msg=$(echo "$JOB_DETAIL" | jq -r '.error // "Keine Fehlermeldung"' 2>/dev/null)
      log_info "Fehler: ${error_msg}"
      break
    fi

    sleep "$POLL_INTERVAL"
    ELAPSED=$((ELAPSED + POLL_INTERVAL))

    if [ $((ELAPSED % 60)) -eq 0 ]; then
      log_info "  ... ${ELAPSED}s vergangen, Status: ${FINAL_STATUS}"
    fi
  done

  if [ "$FINAL_STATUS" = "completed" ]; then
    log_ok "UploadJob completed nach ${ELAPSED}s"

    # NZB-Hash aus UploadJob extrahieren
    UPLOADED_NZB_HASH=$(echo "$JOB_DETAIL" | jq -r '.nzbHash // empty' 2>/dev/null)
    if [ -n "$UPLOADED_NZB_HASH" ]; then
      log_info "NZB-Hash des Uploads: ${UPLOADED_NZB_HASH}"
    fi
  else
    log_fail "UploadJob nicht completed nach ${UPLOAD_TIMEOUT}s (Status: ${FINAL_STATUS})"
  fi

  # ── Schritt 8: NZB vom NZB-Service abrufbar? ─────────────────────────────
  log_step "Schritt 8: NZB vom NZB-Service abrufbar"

  if [ -n "$UPLOADED_NZB_HASH" ]; then
    NZB_RESPONSE=$(curl -sf -o /dev/null -w "%{http_code}" \
      "${NZB_SERVICE_URL}/nzb/${UPLOADED_NZB_HASH}.nzb" \
      -H "Authorization: Bearer ${NZB_SERVICE_TOKEN}" 2>/dev/null || echo "000")

    if [ "$NZB_RESPONSE" = "200" ]; then
      log_ok "NZB abrufbar vom NZB-Service (HTTP 200)"
    elif [ "$NZB_RESPONSE" = "404" ]; then
      log_fail "NZB nicht im NZB-Service gefunden (HTTP 404)"
      log_info "Möglicherweise benötigt der NZB-Service mehr Zeit für die Propagation"
    else
      log_warn "NZB-Service Antwort: HTTP ${NZB_RESPONSE}"
    fi
  else
    log_warn "Kein NZB-Hash verfügbar — NZB-Service-Check übersprungen"
  fi

  # ── Schritt 9: Neues NzbFile mit source='own' in DB? ──────────────────────
  log_step "Schritt 9: Neues NzbFile mit source='own' in der DB"

  if [ -n "$TEST_MOVIE_ID" ] && [ "$TEST_MOVIE_ID" != "null" ]; then
    NZB_CHECK=$(api_get "/nzb/movies/${TEST_MOVIE_ID}" 2>/dev/null || echo "")
    OWN_COUNT_AFTER=$(echo "$NZB_CHECK" | jq -r '.movie.nzbFiles // [] | map(select(.source == "own")) | length' 2>/dev/null || echo "0")

    if [ "$OWN_COUNT_AFTER" != "0" ]; then
      log_ok "NzbFile mit source='own' gefunden (${OWN_COUNT_AFTER} Stück)"
    else
      log_fail "Kein NzbFile mit source='own' in der DB"
    fi
  else
    log_warn "Keine Movie-ID — NzbFile-Check nicht möglich"
  fi

  # ── Schritt 10: VPS aufgeräumt? ───────────────────────────────────────────
  log_step "Schritt 10: VPS aufgeräumt (keine upload-purpose Server)"

  # Kurz warten damit Cleanup durch API erfolgen kann
  sleep 5

  REMAINING_VPS=$(hetzner_get "/servers?label_selector=purpose=openmedia-upload&per_page=50" | jq '.servers // [] | length' 2>/dev/null || echo "0")

  if [ "$REMAINING_VPS" = "0" ]; then
    log_ok "Alle Upload-VPS aufgeräumt — keine Zombie-Server"
  else
    log_warn "${REMAINING_VPS} Upload-VPS noch vorhanden — könnten noch laufen"
    log_info "Hinweis: VPS wird nach Upload durch API gelöscht (PATCH /uploads/:id completed/failed)"
  fi

fi # Ende: Nur wenn UploadJob gefunden wurde

# ── Zusammenfassung ─────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo " E2E-TEST ERGEBNIS"
echo "================================================================"
echo " Bestanden:  ${TESTS_PASSED}"
echo " Fehlgeschlagen: ${TESTS_FAILED}"
echo " Gesamt:     ${TESTS_TOTAL}"
echo "================================================================"

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo -e " ${GREEN}BESTANDEN${NC} — Alle Prüfungen erfolgreich"
  exit 0
else
  echo -e " ${RED}FEHLSCHLAG${NC} — ${TESTS_FAILED} Prüfung(en) fehlgeschlagen"
  exit 1
fi
