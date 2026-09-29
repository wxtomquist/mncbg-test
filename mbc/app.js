// build: nav-highlight-fix-v1

function parseTime(t){
  if(!t) return 0;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(!m) return 0;
  let h = parseInt(m[1],10);
  const min = parseInt(m[2],10);
  const ampm = m[3].toUpperCase();
  if(ampm==='PM' && h!==12) h+=12;
  if(ampm==='AM' && h===12) h=0;
  return h*60+min;
}

// build: affinity-typo-fix-v1
const state = {
  data: null,
  view: 'schedule',
  favorites: new Set(),
  storedFavorites: JSON.parse(localStorage.getItem('mbc-favorites-v1') || '[]'),
  deferredPrompt: null,
  activeDay: 'all',
};

const els = {
  installBtn: document.getElementById('installBtn'),
  tabs: [...document.querySelectorAll('.tab')],
  navButtons: [...document.querySelectorAll('[data-nav]')],
  searchInput: document.getElementById('searchInput'),
  trackFilter: document.getElementById('trackFilter'),
  typeFilter: document.getElementById('typeFilter'),
  blockFilter: document.getElementById('blockFilter'),
  dayToggleWrap: document.getElementById('dayToggleWrap'),
  scheduleView: document.getElementById('view-schedule'),
  presentersView: document.getElementById('view-presenters'),
  exhibitorsView: document.getElementById('view-exhibitors'),
  mapView: document.getElementById('view-map'),
  infoView: document.getElementById('view-info'),
  myScheduleView: document.getElementById('view-my-schedule'),
  raffleView: document.getElementById('view-raffle'),
  todayAtAGlance: document.getElementById('todayAtAGlance'),
  atAGlanceHeading: document.getElementById('atAGlanceHeading'),
  trackLegend: document.getElementById('trackLegend'),
  statSessions: document.getElementById('statSessions'),
  statPresenters: document.getElementById('statPresenters'),
  statExhibitors: document.getElementById('statExhibitors'),
  dialog: document.getElementById('detailDialog'),
  dialogContent: document.getElementById('dialogContent'),
  closeDialog: document.getElementById('closeDialog'),
};

const typeLabels = {
  keynote: 'Keynote',
  session: 'Session',
  affinity_group: 'Affinity Group',
  social: 'Social',
  meal: 'Meal',
  exhibitor: 'Exhibitor',
};

fetch('data/conference-data.json')
  .then((r) => r.json())
  .then((data) => {
    data.sessions = (data.sessions || []).map((session) => ({
      ...session,
      favoriteKey: buildFavoriteKey(session),
      legacyFavoriteKey: buildLegacyFavoriteKey(session),
    }));
    state.data = data;
    state.favorites = new Set(resolveStoredFavorites(state.storedFavorites, data.sessions));
    persistFavorites();
    init();
  });

function normalizeFavoriteText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

function buildFavoriteKey(session) {
  return [
    session.date || '',
    normalizeFavoriteText(session.startTime),
    normalizeFavoriteText(session.title),
  ].join('|');
}

function buildLegacyFavoriteKey(session) {
  return [
    session.date || '',
    normalizeFavoriteText(session.startTime),
    normalizeFavoriteText(session.endTime),
    normalizeFavoriteText(session.block || session.type || ''),
    normalizeFavoriteText(session.location || ''),
  ].join('|');
}

function resolveStoredFavorites(storedFavorites, sessions) {
  const favorites = new Set();
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const byKey = new Map();
  const byLegacyKey = new Map();

  sessions.forEach((session) => {
    byKey.set(session.favoriteKey, session);
    byLegacyKey.set(session.legacyFavoriteKey, session);
  });

  (Array.isArray(storedFavorites) ? storedFavorites : []).forEach((entry) => {
    if (typeof entry === 'string') {
      const bySavedId = byId.get(entry);
      const bySavedKey = byKey.get(entry);
      const bySavedLegacyKey = byLegacyKey.get(entry);
      const resolved = bySavedId || bySavedKey || bySavedLegacyKey;
      if (resolved) favorites.add(resolved.favoriteKey);
      return;
    }

    if (!entry || typeof entry !== 'object') return;

    const byEntryId = entry.id ? byId.get(entry.id) : null;
    const byEntryKey = entry.favoriteKey ? byKey.get(entry.favoriteKey) : null;
    const byEntryLegacyKey = entry.legacyFavoriteKey ? byLegacyKey.get(entry.legacyFavoriteKey) : null;

    const resolved = byEntryId || byEntryKey || byEntryLegacyKey;
    if (resolved) favorites.add(resolved.favoriteKey);
  });

  return [...favorites];
}

function persistFavorites() {
  if (!state.data?.sessions) return;

  const savedEntries = state.data.sessions
    .filter((session) => state.favorites.has(session.favoriteKey))
    .map((session) => ({
      id: session.id,
      favoriteKey: session.favoriteKey,
      legacyFavoriteKey: session.legacyFavoriteKey,
      title: session.title,
      date: session.date,
      startTime: session.startTime,
    }));

  localStorage.setItem('mbc-favorites-v1', JSON.stringify(savedEntries));
}

function ensureValidActiveDay() {
  const dates = [...new Set(state.data.sessions.map((s) => s.date).filter(Boolean))].sort();
  if (dates.length === 1) {
    state.activeDay = dates[0];
    return;
  }
  if (state.activeDay !== 'all' && !dates.includes(state.activeDay)) {
    state.activeDay = 'all';
  }
}

function init() {
  ensureValidActiveDay();
  populateStats();
  populateFilters();
  renderDayToggles();
  renderTrackLegend();
  renderAtAGlance();
  renderAllViews();
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener('click', () => {
    if (tab.dataset.externalLink) {
      window.open(tab.dataset.externalLink, '_blank', 'noopener,noreferrer');
      return;
    }
    setView(tab.dataset.view);
  }));
  els.navButtons.forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.nav)));
  [els.searchInput, els.trackFilter, els.typeFilter, els.blockFilter].forEach((el) => {
    el.addEventListener('input', renderSchedule);
    el.addEventListener('change', renderSchedule);
  });
  els.closeDialog.addEventListener('click', () => els.dialog.close());

  els.presentersView.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-open-presenter]');
    if (!btn) return;
    event.preventDefault();
    openPresenter(btn.dataset.openPresenter);
  });

  els.exhibitorsView.addEventListener('click', (event) => {
    const mapBtn = event.target.closest('[data-open-map]');
    if(mapBtn){
      event.preventDefault();
      openMapImage();
      return;
    }
    const boardBtn = event.target.closest('[data-open-sponsor-board]');
    if (boardBtn) {
      event.preventDefault();
      openSponsorBoard();
      return;
    }
    const btn = event.target.closest('[data-open-exhibitor]');
    if (!btn) return;
    event.preventDefault();
    openExhibitor(btn.dataset.openExhibitor);
  });

  els.dialogContent.addEventListener('click', (event) => {
    const raffleDetailBtn = event.target.closest('[data-open-raffle]');
    if (raffleDetailBtn) {
      event.preventDefault();
      openRaffleDetails(raffleDetailBtn.dataset.openRaffle);
      return;
    }
    const raffleBoardBtn = event.target.closest('[data-open-raffle-board]');
    if (raffleBoardBtn) {
      event.preventDefault();
      openRaffleImage();
      return;
    }
    const mapBtn = event.target.closest('[data-open-map]');
    if(mapBtn){
      event.preventDefault();
      openMapImage();
      return;
    }
    const boardBtn = event.target.closest('[data-open-sponsor-board]');
    if (boardBtn) {
      event.preventDefault();
      openSponsorBoard();
      return;
    }
    const exhibitorBtn = event.target.closest('[data-open-exhibitor]');
    if (exhibitorBtn) {
      event.preventDefault();
      openExhibitor(exhibitorBtn.dataset.openExhibitor);
      return;
    }

    const presenterBtn = event.target.closest('[data-open-presenter]');
    if (presenterBtn) {
      event.preventDefault();
      openPresenter(presenterBtn.dataset.openPresenter);
      return;
    }

    const sessionBtn = event.target.closest('[data-open]');
    if (sessionBtn) {
      event.preventDefault();
      openSession(sessionBtn.dataset.open);
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function populateStats() {
  els.statSessions.textContent = state.data.sessions.length;
  els.statPresenters.textContent = state.data.presenters.length;
  els.statExhibitors.textContent = state.data.exhibitors.length;
}

function populateFilters() {
  const tracks = [...new Set(state.data.sessions.map((s) => s.track).filter(Boolean))].sort();
  const types = [...new Set(state.data.sessions.map((s) => s.type).filter(Boolean))].sort();
  const blocks = [...new Set(state.data.sessions.map((s) => s.block).filter(Boolean))].sort();
  tracks.forEach((v) => els.trackFilter.add(new Option(v, v)));
  types.forEach((v) => els.typeFilter.add(new Option(typeLabels[v] || v, v)));
  blocks.forEach((v) => els.blockFilter.add(new Option(v, v)));
}

function renderDayToggles() {
  const dates = [...new Set(state.data.sessions.map((s) => s.date).filter(Boolean))].sort();
  const counts = Object.fromEntries(dates.map((date) => [date, state.data.sessions.filter((s) => s.date === date).length]));
  const chips = dates.length === 1
    ? dates.map((date) => ({
        key: date,
        label: shortDateLabel(date),
        count: counts[date],
      }))
    : [{ key: 'all', label: 'All Days', count: state.data.sessions.length }, ...dates.map((date) => ({
        key: date,
        label: shortDateLabel(date),
        count: counts[date],
      }))];

  els.dayToggleWrap.innerHTML = chips.map((chip) => `
    <button class="day-chip ${state.activeDay === chip.key ? 'active' : ''}" type="button" data-day="${chip.key}">
      <span>${escapeHtml(chip.label)}</span>
      <span class="day-chip-count">${chip.count}</span>
    </button>
  `).join('');

  document.querySelectorAll('[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeDay = btn.dataset.day;
      renderDayToggles();
      renderAtAGlance();
      renderSchedule();
    });
  });
}

function renderTrackLegend() {
  els.trackLegend.innerHTML = state.data.tracks.map((track) => `
    <div class="legend-item">
      <span class="swatch" style="background:${track.color || '#003B4A'}"></span>
      <span>${escapeHtml(track.name)}</span>
    </div>
  `).join('');
}

function bindAtAGlanceActions() {
  els.todayAtAGlance.querySelectorAll('[data-jump-to]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.jumpTo;
      setView('schedule');

      window.setTimeout(() => {
        const target = document.querySelector(`[data-session-card="${targetId}"]`);
        if (!target) return;
        scrollToSectionWithOffset(target);
        target.classList.add('card-pulse');
        window.setTimeout(() => target.classList.remove('card-pulse'), 1800);
      }, 450);
    });
  });
}

function renderAtAGlance() {
  const sourceItems = state.activeDay === 'all'
    ? [...state.data.sessions]
    : state.data.sessions.filter((s) => s.date === state.activeDay);

  const items = sourceItems
    .filter((item) => !String(item.id || '').includes('-affinity-group-'))
    .sort((a,b)=> parseTime(a.startTime) - parseTime(b.startTime));

  els.atAGlanceHeading.textContent = getAtAGlanceHeading();

  els.todayAtAGlance.innerHTML = items.map((item) => `
    <button class="timeline-mini timeline-mini-btn" type="button" data-jump-to="${item.id}">
      <time>${escapeHtml(item.startTime)}</time>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="meta-line">${escapeHtml(item.location || item.block || typeLabels[item.type] || item.type)}</div>
      </div>
    </button>
  `).join('');

  bindAtAGlanceActions();
}

function scrollToSectionWithOffset(target) {
  if (!target) return;
  const nav = document.querySelector('.tabs');
  const navHeight = nav ? nav.getBoundingClientRect().height : 0;
  const extraGap = 12;
  const targetTop = target.getBoundingClientRect().top + window.scrollY;
  const finalTop = Math.max(0, targetTop - navHeight - extraGap);
  window.scrollTo({ top: finalTop, behavior: 'smooth' });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${view}`);
  targetView.classList.add('active');
  els.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
  document.getElementById('controlsBar').style.display = view === 'schedule' ? 'grid' : 'none';
  if (view === 'my-schedule') renderMySchedule();

  const scrollTarget = view === 'schedule'
    ? document.getElementById('controlsBar')
    : targetView;

  if (scrollTarget) {
    requestAnimationFrame(() => {
      scrollToSectionWithOffset(scrollTarget);
    });
  }
}

function renderAllViews() {
  renderSchedule();
  renderPresenters();
  renderExhibitors();
  renderMap();
  renderInfo();
  renderMySchedule();
  renderRaffle();
}

function getFilteredSessions() {
  const q = els.searchInput.value.trim().toLowerCase();
  const track = els.trackFilter.value;
  const type = els.typeFilter.value;
  const block = els.blockFilter.value;

  return state.data.sessions.filter((s) => {
    const haystack = [
      s.title, s.location, s.track, s.block, s.description, ...(s.speakers || []), ...(s.moderators || [])
    ].join(' ').toLowerCase();

    const titleNorm = String(s.title || '').toLowerCase().replace(/[^a-z]/g, '');
    const isAffinityLogisticsPlaceholder =
      String(s.id || '').includes('-logistics-') &&
      (titleNorm.includes('affinitygroup') || titleNorm.includes('afinitygroup'));

    return !isAffinityLogisticsPlaceholder
      && (!q || haystack.includes(q))
      && (state.activeDay === 'all' || s.date === state.activeDay)
      && (!track || s.track === track)
      && (!type || s.type === type)
      && (!block || s.block === block);
  }).sort((a,b)=> parseTime(a.startTime) - parseTime(b.startTime));
}

function groupBy(arr, getKey) {
  return arr.reduce((acc, item) => {
    const key = getKey(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

function renderSchedule() {
  const sessions = getFilteredSessions();
  if (!sessions.length) {
    els.scheduleView.innerHTML = `<div class="card empty-state">No schedule items matched your filters.</div>`;
    return;
  }

  const byDate = groupBy(sessions, (s) => s.date);
  els.scheduleView.innerHTML = Object.entries(byDate).map(([date, dayItems]) => {
    const byBlock = groupBy(dayItems, (s) => `${s.startTime}|||${s.block || typeLabels[s.type] || 'Other'}`);
    const blocks = Object.entries(byBlock).map(([blockKey, items]) => {
      const [startTime, blockName] = blockKey.split('|||');
      return `
        <div class="block-group">
          <div class="day-header">
            <h4 class="block-title">${escapeHtml(startTime)} · ${escapeHtml(blockName)}</h4>
            <span class="chip">${items.length} item${items.length === 1 ? '' : 's'}</span>
          </div>
          <div class="session-grid">
            ${items.map(renderSessionCard).join('')}
          </div>
        </div>
      `;
    }).join('');
    return `
      <div class="day-group">
        <div class="day-header">
          <h3>${formatDate(date)}</h3>
          <span class="chip">${dayItems.length} total</span>
        </div>
        ${blocks}
      </div>
    `;
  }).join('');

  bindCardActions(els.scheduleView);
}

function renderSessionCard(item) {
  const color = item.trackMeta?.color || '#003B4A';
  const saved = state.favorites.has(item.favoriteKey);
  return `
    <article class="card session-card" data-session-card="${item.id}">
      <div class="meta">
        <span class="type-badge">${escapeHtml(typeLabels[item.type] || item.type)}</span>
        ${item.track ? `<span class="chip"><span class="swatch" style="background:${color}"></span>${escapeHtml(item.track)}</span>` : ''}
      </div>
      <h4>${escapeHtml(item.title)}</h4>
      <div class="stack">
        <div class="meta-line"><strong>${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</strong></div>
        ${item.location ? `<div class="meta-line"><strong>Location:</strong> ${escapeHtml(item.location)}</div>` : ''}
        ${(item.speakers || []).length ? `<div class="meta-line"><strong>${item.speakers.length > 1 ? 'Presenters:' : 'Presenter:'}</strong> ${escapeHtml(item.speakers.join(', '))}</div>` : ''}
        ${(item.moderators || []).length ? `<div class="meta-line"><strong>Moderator:</strong> ${escapeHtml(item.moderators.join(', '))}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="ghost-btn" data-open="${item.id}">Details</button>
        <button class="save-btn ${saved ? 'saved' : ''}" data-save="${item.id}">
          ${saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </article>
  `;
}

function bindCardActions(root = document) {
  root.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openSession(btn.dataset.open));
  });
  root.querySelectorAll('[data-save]').forEach((btn) => {
    btn.addEventListener('click', () => toggleFavorite(btn.dataset.save));
  });
}

function bindExhibitorActions(root = document) {
  root.querySelectorAll('[data-open-exhibitor]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openExhibitor(btn.dataset.openExhibitor);
    });
  });
}

function bindSponsorBoardActions(root = document) {
  root.querySelectorAll('[data-open-sponsor-board]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      openSponsorBoard();
    });
  });
}

function openSponsorBoard() {
  els.dialogContent.innerHTML = `
    <h2>Sponsors & Exhibitors</h2>
    <img class="dialog-board-image" src="assets/exhibitors-sponsors.png" alt="Sponsor and exhibitor board" />
  `;
  if (els.dialog.open) els.dialog.close();
  els.dialog.showModal();
}

function openExhibitor(id) {
  const ex = state.data.exhibitors.find((e) => e.id === id);
  if (!ex) return;
  els.dialogContent.innerHTML = `
    <h2>${escapeHtml(ex.name)}</h2>
    <div class="stack" style="margin-top:14px">
      ${ex.boothNumber !== '' && ex.boothNumber !== undefined ? `<div class="meta-line"><strong>Booth:</strong> ${escapeHtml(String(ex.boothNumber))}</div>` : ''}
      ${ex.sponsorLevel ? `<div class="meta-line"><strong>Sponsor Level:</strong> ${escapeHtml(ex.sponsorLevel)}</div>` : ''}
      ${ex.website ? `<div class="meta-line"><strong>Website:</strong> <a href="${escapeHtml(ex.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ex.website)}</a></div>` : ''}
      ${ex.email ? `<div class="meta-line"><strong>Email:</strong> <a href="mailto:${escapeHtml(ex.email)}" class="email-link">${escapeHtml(ex.email)}</a></div>` : ''}
    </div>
    ${ex.notes ? `<p style="margin-top:16px">${escapeHtml(ex.notes)}</p>` : ''}
  `;
  els.dialog.showModal();
}

function bindPresenterActions(root = document) {
  root.querySelectorAll('[data-open-presenter]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPresenter(btn.dataset.openPresenter);
    });
  });
}

function openSession(sessionId) {
  const item = state.data.sessions.find((s) => s.id === sessionId);
  if (!item) return;
  const trackChip = item.track ? `<span class="chip"><span class="swatch" style="background:${item.trackMeta?.color || '#003B4A'}"></span>${escapeHtml(item.track)}</span>` : '';
  const presenterLinks = (item.speakerIds || []).map((id) => {
    const presenter = state.data.presenters.find((p) => p.id === id);
    return presenter ? `<button class="ghost-btn" data-open-presenter="${presenter.id}">${escapeHtml(presenter.name)}</button>` : '';
  }).join(' ');

  els.dialogContent.innerHTML = `
    <p class="pill">${escapeHtml(typeLabels[item.type] || item.type)}</p>
    <h2>${escapeHtml(item.title)}</h2>
    <div class="meta">
      ${trackChip}
      ${item.block ? `<span class="chip">${escapeHtml(item.block)}</span>` : ''}
    </div>
    <div class="stack" style="margin-top:14px">
      <div class="meta-line"><strong>${escapeHtml(formatDate(item.date))}</strong></div>
      <div class="meta-line"><strong>${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</strong></div>
      ${item.location ? `<div class="meta-line"><strong>Location:</strong> ${escapeHtml(item.location)}</div>` : ''}
      ${(item.speakers || []).length ? `<div class="meta-line"><strong>${item.speakers.length > 1 ? 'Presenters:' : 'Presenter:'}</strong> ${escapeHtml(item.speakers.join(', '))}</div>` : ''}
      ${(item.moderators || []).length ? `<div class="meta-line"><strong>Moderator:</strong> ${escapeHtml(item.moderators.join(', '))}</div>` : ''}
    </div>
    ${item.description ? `<p style="margin-top:16px">${escapeHtml(item.description)}</p>` : '<p style="margin-top:16px;color:var(--muted)">Description can be expanded later.</p>'}
    ${presenterLinks ? `<div class="meta" style="margin-top:16px">${presenterLinks}</div>` : ''}
    ${item.notes ? `<p style="margin-top:16px;color:var(--muted)"><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ''}
  `;
  els.dialog.showModal();
  bindPresenterActions(els.dialogContent);
}

function openPresenter(id) {
  const presenter = state.data.presenters.find((p) => p.id === id);
  if (!presenter) return;
  const sessions = state.data.sessions.filter((s) => presenter.sessionIds.includes(s.id));

  els.dialogContent.innerHTML = `
    <h2>${escapeHtml(presenter.name)}</h2>
    ${presenter.bio ? `<p>${escapeHtml(presenter.bio)}</p>` : '<p style="color:var(--muted)">Bio can be added later.</p>'}
    ${sessions.length ? `<h3 style="margin-top:20px">Sessions</h3>` : ''}
    <div class="stack">
      ${sessions.map((item) => `
        <div class="meta-line"><strong>${escapeHtml(item.title)}</strong></div>
        <button class="ghost-btn" data-open="${item.id}">${escapeHtml(item.startTime)}${item.location ? ` · ${escapeHtml(item.location)}` : ''}</button>
      `).join('')}
    </div>
  `;
  bindCardActions(els.dialogContent);
  if (els.dialog.open) els.dialog.close();
  els.dialog.showModal();
}

function toggleFavorite(id) {
  const session = state.data.sessions.find((s) => s.id === id);
  if (!session) return;

  const key = session.favoriteKey;
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
  } else {
    state.favorites.add(key);
  }

  persistFavorites();
  renderSchedule();
  renderMySchedule();
}

function renderMySchedule() {
  const items = state.data.sessions.filter((s) => state.favorites.has(s.favoriteKey)).sort((a,b)=> parseTime(a.startTime) - parseTime(b.startTime));
  els.myScheduleView.innerHTML = items.length
    ? `<div class="day-group"><div class="session-grid">${items.map(renderSessionCard).join('')}</div></div>`
    : `<div class="card empty-state">Save sessions to build your personal schedule.</div>`;
  bindCardActions(els.myScheduleView);
}

function renderPresenters() {
  const withSessions = state.data.presenters
    .filter((p) => p.sessionIds.length)
    .sort((a,b) => a.name.localeCompare(b.name));

  els.presentersView.innerHTML = `
    <div class="list-grid">
      ${withSessions.map((p) => `
        <article class="card presenter-card">
          <h4>${escapeHtml(p.name)}</h4>
          ${p.presentationTitle ? `<p>${escapeHtml(p.presentationTitle)}</p>` : ''}
          <button class="ghost-btn" type="button" data-open-presenter="${p.id}">Details</button>
        </article>
      `).join('')}
    </div>
  `;
  bindPresenterActions(els.presentersView);
}

function renderExhibitors() {
  const items = [...state.data.exhibitors];

  const conferenceSponsor = items.filter((ex) => ex.name === 'Husch Blackwell');
  const awardsSponsor = items.filter((ex) => ex.name === 'Lagersmith');
  const silverSponsors = items
    .filter((ex) => ex.name !== 'Husch Blackwell' && ex.name !== 'Lagersmith' && String(ex.sponsorLevel || '').toLowerCase().includes('silver'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const bronzeSponsors = items
    .filter((ex) => ex.name !== 'Husch Blackwell' && ex.name !== 'Lagersmith' && String(ex.sponsorLevel || '').toLowerCase().includes('bronze'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exhibitors = items
    .filter((ex) => ex.name !== 'Husch Blackwell' && ex.name !== 'Lagersmith' && !String(ex.sponsorLevel || '').toLowerCase().includes('silver') && !String(ex.sponsorLevel || '').toLowerCase().includes('bronze'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderGroup = (title, group) => {
    if (!group.length) return '';
    return `
      <div class="exhibitor-group">
        <h4 class="group-heading">${escapeHtml(title)}</h4>
        <div class="list-grid">
          ${group.map((ex) => `
            <article class="card exhibitor-card">
              <h4>${ex.website ? `<a href="${escapeHtml(ex.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ex.name)}</a>` : escapeHtml(ex.name)}</h4>
              <div class="card-actions">
                <button class="ghost-btn" type="button" data-open-exhibitor="${ex.id}">Details</button>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    `;
  };

  els.exhibitorsView.innerHTML = `
    <section class="sponsors-exhibitors-layout">
      <article class="card sponsor-summary-card sponsor-image-card compact">
        <div class="sponsor-image-card-head">
          <div>
            <h3>Sponsors & Exhibitors</h3>
          </div>
        </div>
        <button class="sponsor-board-thumb compact" type="button" data-open-sponsor-board="true" aria-label="Open sponsor and exhibitor board image">
          <img src="assets/exhibitors-sponsors.png" alt="Sponsor and exhibitor board" />
        </button>
      </article>

      <div class="sponsors-exhibitors-content">
        ${renderGroup('Conference Presenting Sponsor', conferenceSponsor)}
        ${renderGroup('Awards Presenting Sponsor', awardsSponsor)}
        ${renderGroup('Silver Sponsors', silverSponsors)}
        ${renderGroup('Bronze Sponsors', bronzeSponsors)}
        ${renderGroup('Exhibitors', exhibitors)}
      </div>
    </section>
  `;
  bindExhibitorActions(els.exhibitorsView);
  bindSponsorBoardActions(els.exhibitorsView);
}

function openMapImage() {
  els.dialogContent.innerHTML = `
    <h2>Conference Map</h2>
    <img class="dialog-board-image" src="assets/conference-map.png" alt="Conference map" />
  `;
  if (els.dialog.open) els.dialog.close();
  els.dialog.showModal();
}

function bindMapActions(root = document){
  root.querySelectorAll('[data-open-map]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openMapImage();
    });
  });
}

function renderMap() {
  els.mapView.innerHTML = `
    <article class="card map-card">
      <h3>Conference Map</h3>
      <button class="map-image-button" type="button" data-open-map="conference" aria-label="Open full-size conference map">
        <img class="map-image-full" src="assets/conference-map.png" alt="Conference map" />
      </button>
    </article>
  `;
  bindMapActions(els.mapView);
}

function openRaffleImage() {
  els.dialogContent.innerHTML = `
    <h2>Raffle</h2>
    <img class="dialog-board-image" src="assets/raffle-info.png" alt="Raffle information board" />
  `;
  if (els.dialog.open) els.dialog.close();
  els.dialog.showModal();
}

function bindRaffleActions(root = document) {
  root.querySelectorAll('[data-open-raffle-board]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      openRaffleImage();
    });
  });

  root.querySelectorAll('[data-open-raffle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      openRaffleDetails(btn.dataset.openRaffle);
    });
  });
}

function openRaffleDetails(id) {
  const item = state.data.raffles.find(r => r.raffleNo === id);
  if (!item) return;
  els.dialogContent.innerHTML = `
    <h2>${escapeHtml(item.raffleNo)}${item.companyName ? ` · ${escapeHtml(item.companyName)}` : ''}</h2>
    ${item.description ? `<p><strong>Item:</strong> ${escapeHtml(item.description)}</p>` : ''}
    ${item.estimatedValueUsd !== '' && item.estimatedValueUsd !== undefined ? `<p><strong>Estimated Value:</strong> $${escapeHtml(String(item.estimatedValueUsd))}</p>` : ''}
    ${item.contactName ? `<p><strong>Contact:</strong> ${escapeHtml(item.contactName)}</p>` : ''}
    ${item.contactEmail ? `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(item.contactEmail)}" class="email-link">${escapeHtml(item.contactEmail)}</a></p>` : ''}
    ${item.contactPhone ? `<p><strong>Phone:</strong> ${escapeHtml(item.contactPhone)}</p>` : ''}
  `;
  if (els.dialog.open) els.dialog.close();
  els.dialog.showModal();
}

function renderRaffle() {
  const raffles = state.data.raffles || [];
  els.raffleView.innerHTML = `
    <section class="sponsors-exhibitors-layout">
      <article class="card sponsor-summary-card sponsor-image-card compact">
        <div class="sponsor-image-card-head">
          <div>
            <h3>Raffle</h3>
          </div>
        </div>
        <button class="sponsor-board-thumb compact" type="button" data-open-raffle-board="true" aria-label="Open raffle information image">
          <img src="assets/raffle-info.png" alt="Raffle information" />
        </button>
      </article>

      <div class="sponsors-exhibitors-content">
        <article class="card sponsor-summary-card">
          <h3>Raffle Summary</h3>
          <p class="subtle-note">Paper raffle tickets are in your conference bag.</p>
          <p class="subtle-note">Review drawing times, sponsors, raffle items, and estimated values below.</p>
        </article>

        <div class="list-grid">
          ${raffles.map((item) => `
            <article class="card exhibitor-card raffle-card">
  <h4>${escapeHtml(item.raffleNo)}${item.companyName ? ` · ${escapeHtml(item.companyName)}` : ''}</h4>
  <div class="card-actions">
    <button class="ghost-btn" type="button" data-open-raffle="${item.raffleNo}">Details</button>
  </div>
</article>
          `).join('')}
        
</div>
      </div>
    </section>
  `;
  bindRaffleActions(els.raffleView);
}

function renderInfo() {
  els.infoView.innerHTML = `
    <div class="info-grid">
      <div class="card">
        <h3>Conference Info</h3>
        <div class="info-list">
          <p><strong>Event:</strong> ${escapeHtml(state.data.conference.name)} ${state.data.conference.year}</p>
          <p><strong>Dates:</strong> Friday, April 10, 2026</p>
          <p><strong>Host:</strong> ${escapeHtml(state.data.conference.host)}</p>
          <p><strong>Wi-Fi:</strong> Hilton Conference WiFi<br><strong>Password:</strong> MSPAH_Conf</p>
          <p><strong>Code of Conduct:</strong> <a class="info-link" href="https://www.mncraftbrew.org/wp-content/uploads/2023/12/CodeofConduct.pdf" target="_blank">View Code of Conduct</a></p>
          <p><strong>Help/Safety:</strong> Please contact the Front Desk, MNCBG staff, or Hilton staff for assistance.</p>
          <p><a class="info-link" href="assets/conference-program.pdf" target="_blank">Conference Program</a></p>
          <p><a class="info-link" href="assets/conference-beer.pdf" target="_blank">Check out the conference beer!</a></p>
        </div>
      </div>

      <div class="card">
        <h3>Install This App</h3>
        <div class="info-list">
          <p><strong>iPhone (Safari)</strong></p>
          <p>Tap the share icon (square with arrow), then scroll and tap <strong>Add to Home Screen</strong>.</p>

          <p><strong>Android</strong></p>
          <p>Tap the <strong>Install App</strong> button if prompted, or use your browser menu and select <strong>Add to Home Screen</strong>.</p>
        </div>
      </div>

      <div class="card">
        <h3>Member Opportunities</h3>
        <div class="info-list">
          <p><strong>Festivals & Events</strong></p>
          <p>Opportunities include participation in All Pints North, Autumn Brew Review, Minnesota State Fair “Brewed in Minnesota,” and MN Beer Day events.</p>
          <p><a class="info-link" href="https://www.mncraftbrew.org/open-activities/" target="_blank">View all current member activities & opportunities</a></p>
        </div>
      </div>
    </div>
  `;
}

function getAtAGlanceHeading() {
  const dates = [...new Set(state.data.sessions.map((s) => s.date).filter(Boolean))].sort();

  if (state.activeDay === 'all') {
    if (dates.length === 1) {
      const d = new Date(`${dates[0]}T12:00:00`);
      const month = d.toLocaleDateString(undefined, { month: 'long' });
      const day = d.toLocaleDateString(undefined, { day: 'numeric' });
      return `${month} ${day} at a glance`;
    }
    return 'April 9–10 at a glance';
  }

  const d = new Date(`${state.activeDay}T12:00:00`);
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  const day = d.toLocaleDateString(undefined, { day: 'numeric' });
  return `${month} ${day} at a glance`;
}

function shortDateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
