// update-banner.js — Browser tab: silent auto-update.
// Standalone app (phone or PC): modal for majors with only "Update now".
// No auto-reload on initial install; reload only after user clicks Update.
// Always fetch version.json fresh.
(function () {
  const CONFIG = {
    versionUrl: '/version.json',
    gateBySemverMajor: true,
    gateBySeverityField: true,
    storage: {
      seenVersionKey: 'mncbg_seen_version',
      pendingNotesKey: 'mncbg_pending_notes',  // { version, notes[], date }
      ackKey: 'mncbg_major_ack'
    }
  };

  // Detect installed (standalone) vs regular tab
  const isStandalone = (() => {
    const mql = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const ios = typeof window.navigator.standalone === 'boolean' ? window.navigator.standalone : false;
    return !!(mql || ios);
  })();

  // Always-fresh version.json
  async function fetchVersionInfo() {
    const u = new URL(CONFIG.versionUrl, location.origin);
    u.searchParams.set('_', String(Date.now()));
    try {
      const res = await fetch(u.toString(), { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  // Semver helpers
  const parseSemver = v => {
    const [ma, mi, pa] = String(v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
    return { major: ma, minor: mi, patch: pa };
  };
  const isMajorBump = (prev, curr) => parseSemver(curr).major > parseSemver(prev).major;

  function shouldGate(prevVersion, info) {
    if (!info || !info.version) return false;
    const ackVer = localStorage.getItem(CONFIG.storage.ackKey) || null;
    const alreadyAcked = ackVer === info.version;
    const bySemver = CONFIG.gateBySemverMajor && prevVersion && isMajorBump(prevVersion, info.version);
    const bySeverity = CONFIG.gateBySeverityField && String(info.severity || '').toLowerCase() === 'major';
    return (bySemver || bySeverity) && !alreadyAcked;
  }

  function savePendingNotes(info) {
    if (!info || !info.version) return;
    const payload = {
      version: info.version,
      date: info.date || '',
      notes: Array.isArray(info.notes) ? info.notes : []
    };
    localStorage.setItem(CONFIG.storage.pendingNotesKey, JSON.stringify(payload));
    localStorage.setItem(CONFIG.storage.seenVersionKey, info.version);
  }

  function getPendingNotes() {
    try { return JSON.parse(localStorage.getItem(CONFIG.storage.pendingNotesKey) || 'null'); }
    catch { return null; }
  }

  function clearPendingFor(version) {
    const raw = localStorage.getItem(CONFIG.storage.pendingNotesKey);
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      if (obj && obj.version === version) localStorage.removeItem(CONFIG.storage.pendingNotesKey);
    } catch {}
  }

  // Modal (no close, only Update)
  function ensureModalStyles() {
    if (document.getElementById('apn-modal-styles')) return;
    const css = `
      .apn-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2200;display:flex;align-items:center;justify-content:center}
      .apn-modal{width:min(780px,calc(100% - 24px));background:linear-gradient(180deg,var(--panel,#202536),var(--panel-2,#262d41));color:var(--text,#eef2f7);border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:16px}
      .apn-modal h3{margin:0 0 6px;font-size:18px;font-weight:800}
      .apn-modal .muted{color:var(--muted,#b6bdc8);margin:0 0 12px}
      .apn-modal ul{margin:0 0 14px 18px;padding:0}
      .apn-modal li{margin:6px 0}
      .apn-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      .apn-btn{cursor:pointer;border-radius:12px;padding:8px 12px;font-weight:700;border:1px solid rgba(79,209,197,.55);background:linear-gradient(180deg,rgba(79,209,197,.42),rgba(79,209,197,.26));color:var(--text,#eef2f7)}
      .apn-btn[disabled]{opacity:.6;cursor:not-allowed}
    `;
    const style = document.createElement('style');
    style.id = 'apn-modal-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showMajorUpdateModal(payload, onUpdateNow, enableWhenReady) {
    if (!payload || !payload.version) return;
    ensureModalStyles();

    const backdrop = document.createElement('div');
    backdrop.className = 'apn-modal-backdrop';
    backdrop.addEventListener('click', (e) => e.stopPropagation());

    const el = document.createElement('div');
    el.className = 'apn-modal';

    const dateLine = payload.date ? ` — <span class="muted">${payload.date}</span>` : '';
    const notes = (payload.notes && payload.notes.length)
      ? `<ul>${payload.notes.map(n => `<li>${String(n).replace(/</g,'&lt;')}</li>`).join('')}</ul>`
      : '<p class="muted">No additional details provided.</p>';

    el.innerHTML = `
      <h3>What's new in Minnesota Craft Brewers Guild Events ${payload.version}${dateLine}</h3>
      ${notes}
      <div class="apn-actions">
        <button class="apn-btn" id="apn-update-now">Update now</button>
      </div>
    `;
    backdrop.appendChild(el);
    document.body.appendChild(backdrop);

    const btnNow = el.querySelector('#apn-update-now');
    if (enableWhenReady === false) {
      btnNow.disabled = true;
      btnNow.textContent = 'Preparing update…';
    }

    btnNow.onclick = () => {
      localStorage.setItem(CONFIG.storage.ackKey, payload.version);
      clearPendingFor(payload.version);
      try { onUpdateNow && onUpdateNow(); } catch {}
      backdrop.remove();
    };

    // block ESC close (optional)
    document.addEventListener('keydown', function escBlocker(ev) {
      if (ev.key === 'Escape') ev.preventDefault();
    }, { once: true });

    return {
      enableUpdate() {
        btnNow.disabled = false;
        btnNow.textContent = 'Update now';
      }
    };
  }

  async function init() {
    const prevSeen = localStorage.getItem(CONFIG.storage.seenVersionKey) || null;
    const info = await fetchVersionInfo();

    // Regular browser tab: silent
    if (!isStandalone) {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
          reg.update().catch(()=>{});
          setInterval(() => reg.update().catch(()=>{}), 30 * 60 * 1000);
        } catch {}
      }
      if (info?.version) {
        localStorage.setItem(CONFIG.storage.seenVersionKey, info.version);
        localStorage.removeItem(CONFIG.storage.pendingNotesKey);
      }
      return;
    }

    // Installed app path
    let isMajor = false;
    if (info && info.version) {
      isMajor = shouldGate(prevSeen, info);
      if (isMajor) savePendingNotes(info);
      else {
        localStorage.setItem(CONFIG.storage.seenVersionKey, info.version);
        localStorage.removeItem(CONFIG.storage.pendingNotesKey);
      }
    }

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');

        // Only reload after the user chooses Update now:
        let reloadOnControllerChange = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloadOnControllerChange) location.reload();
        });

        const maybeShowModal = (waiting) => {
          if (!isMajor) return;
          const pending = getPendingNotes() || { version: info?.version, notes: info?.notes || [], date: info?.date || '' };

          // If no waiting worker yet, show disabled button, then enable when ready
          if (!waiting) {
            const handle = showMajorUpdateModal(pending, () => {
              // user chose Update now
              reloadOnControllerChange = true;
              reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
            }, false);

            const unstick = setInterval(() => {
              if (reg.waiting) {
                try { handle && handle.enableUpdate && handle.enableUpdate(); } catch {}
                clearInterval(unstick);
              }
            }, 150);
          } else {
            showMajorUpdateModal(pending, () => {
              // user chose Update now
              reloadOnControllerChange = true;
              reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
            });
          }
        };

        // If an update is already waiting, show modal now
        if (reg.waiting) maybeShowModal(reg.waiting);

        // When a new version is found
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              maybeShowModal(reg.waiting);
            }
          });
        });

        // Proactive checks
        reg.update().catch(()=>{});
        setInterval(() => reg.update().catch(()=>{}), 30 * 60 * 1000);
      } catch (e) {
        console.warn('SW register failed:', e);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
