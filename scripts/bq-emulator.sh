#!/bin/bash
# Beanconqueror (BQ) test bed: headless Android emulator "bq-test" on a fixed port.
# Every adb call is `adb -s $E`, so a physical phone is never touched.
#   start [snapshot]   boot (default: cold boot; or load a snapshot, e.g. bq-clean)
#   stop               kill the emulator (never saves state)
#   save <snapshot>    save a snapshot of the running emulator
#   reset <snapshot>   stop, then start from that snapshot
#   import <dir>       push <dir> (holds Beanconqueror.zip + photos) and run BQ's
#                      "Full import from directory" with scripted taps; prints seconds
#   dump [rows]        read-only counts/linkage from BQ's IndexedDB (rows: per-bean table)
# Needs: JDK-free; Android SDK at ~/Library/Android/sdk, AVD bq-test, BQ APK installed.
set -euo pipefail
SDK=${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}
export PATH=$SDK/platform-tools:$SDK/emulator:$PATH
PORT=5570; E=emulator-$PORT; PKG=com.beanconqueror.app
a() { adb -s "$E" "$@"; }
need() { a get-state >/dev/null 2>&1 || { echo "emulator $E not running (try: $0 start)" >&2; exit 1; }; }

tap_text() { # tap the first uiautomator node whose text matches the regex (native screens only)
  a shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1
  a exec-out cat /sdcard/u.xml | python3 -I -c '
import sys,re
x=sys.stdin.read()
for n in re.findall(r"<node[^>]*>",x):
  t=re.search(r"text=\"([^\"]*)\"",n).group(1)
  if re.search(sys.argv[1],t,re.I):
    b=list(map(int,re.findall(r"\d+",re.search(r"bounds=\"([^\"]*)\"",n).group(1))));print((b[0]+b[2])//2,(b[1]+b[3])//2);break
else: sys.exit(1)' "$1" | { read -r x y && a shell input tap "$x" "$y"; }
}

cdp() { # cdp <js-expression>: evaluate in BQ's WebView over devtools, print JSON result
  local pid; pid=$(a shell pidof "$PKG" | tr -d '\r' | awk '{print $1}')
  a forward tcp:9333 "localabstract:webview_devtools_remote_$pid" >/dev/null
  local ws; ws=$(curl -s localhost:9333/json | python3 -I -c 'import sys,json;print(json.load(sys.stdin)[0]["webSocketDebuggerUrl"])')
  node --input-type=module -e '
const s=new WebSocket(process.argv[1]);
s.onopen=()=>s.send(JSON.stringify({id:1,method:"Runtime.evaluate",params:{expression:process.argv[2],awaitPromise:true,returnByValue:true}}));
s.onmessage=m=>{const r=JSON.parse(m.data);if(r.id===1){console.log(JSON.stringify(r.result?.result?.value??r));process.exit(0)}}' "$ws" "$1"
}

case "${1:-}" in
start)
  snap=${2:-}
  a get-state >/dev/null 2>&1 && { echo "already running"; exit 0; }
  load=(-no-snapshot-load); [ -n "$snap" ] && load=(-snapshot "$snap")
  emulator -avd bq-test -port $PORT -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect \
    -no-snapshot-save "${load[@]}" >"${TMPDIR:-/tmp}/bq-emu.log" 2>&1 &
  until [ "$(a shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 3; done
  a root >/dev/null; sleep 2; echo "up: $E ($(a emu avd name | head -1 | tr -d '\r'))" ;;
stop) a emu kill >/dev/null 2>&1 || true; echo stopped ;;
save) need; a emu avd snapshot save "$2" ;;
reset) "$0" stop; sleep 5; "$0" start "$2" ;;
import)
  need; dir=${2:?dir with Beanconqueror.zip}; t0=$(date +%s)
  a shell rm -rf /sdcard/Download/bq-import; a push "$dir" /sdcard/Download/bq-import >/dev/null
  a shell am start -n $PKG/com.beanconqueror.MainActivity >/dev/null; sleep 4
  # fixed coords for the 1080x2400 AVD: hamburger, Settings, "Full import from directory"
  a shell input tap 72 220; sleep 2; a shell input tap 400 1093; sleep 3; a shell input tap 360 816; sleep 3
  tap_text '^Download$'; sleep 1; tap_text '^bq-import$'; sleep 1; tap_text 'use this folder'; sleep 2
  a shell input tap 878 1388   # "Allow" in the SAF permission dialog
  until [ "$(cdp "document.body.innerText.includes('Import successful')")" = true ]; do sleep 5; done
  echo "import done in $(( $(date +%s) - t0 ))s (incl. push + navigation)" ;;
dump)
  need; mode=${2:-}
  cdp "(async()=>{const db=await new Promise((o,e)=>{const r=indexedDB.open('__baristaDB');r.onsuccess=()=>o(r.result);r.onerror=()=>e(r.error)});
  const g=k=>new Promise(o=>{const r=db.transaction('_ionickv').objectStore('_ionickv').get(k);r.onsuccess=()=>o(r.result)});
  const B=(await g('BEANS'))||[],R=(await g('BREWS'))||[],S=((await g('SETTINGS'))||[{}])[0],o={};
  for(const k of ['BEANS','BREWS','MILL','PREPARATION','WATER','GREEN_BEANS'])o[k]=(await g(k)||[]).length;
  const n={};for(const r of R)n[r.bean]=(n[r.bean]||0)+1;const u=new Set(B.map(b=>b.config.uuid));
  o.brews_linked=R.filter(r=>u.has(r.bean)).length;o.brews_orphaned=R.length-o.brews_linked;
  o.visualizer_blank=Object.fromEntries(['visualizer_url','visualizer_username','visualizer_password'].map(k=>[k,!S[k]]));
  o.visualizer_active=S.visualizer_active;
  if('$mode'==='rows')o.rows=B.map(b=>[b.config.uuid.slice(0,8),b.name,b.weight,b.finished,(b.attachments||[]).length,n[b.config.uuid]||0]);
  return o})()" | python3 -I -c '
import sys,json
o=json.load(sys.stdin);rows=o.pop("rows",None);print(json.dumps(o,indent=1))
if rows:
  print("uuid8\tname\tweight\tfinished\tphotos\tbrews")
  for r in rows:print("\t".join(map(str,r)))' ;;
*) sed -n 2,12p "$0"; exit 1 ;;
esac
