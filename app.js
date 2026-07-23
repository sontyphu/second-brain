(function () {
  const C = window.COURSE;
  const LS_DONE = 'second-brain-progress-v1';  // bài đã xem
  const LS_COLL = 'second-brain-collapse-v1';  // nhóm đang gập

  // Phẳng hoá danh sách bài theo thứ tự + gắn group
  const flat = [];
  C.groups.forEach(g => g.pages.forEach(p => flat.push({ ...p, group: g })));
  const trackable = flat.filter(p => p.track);
  const TOTAL = flat.length;

  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  let done = load(LS_DONE);
  let collapsed = load(LS_COLL);
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => String(s).replace(/"/g, '&quot;');

  // ---- Dựng sidebar ----
  const nav = document.getElementById('nav');
  function buildNav() {
    nav.innerHTML = '';
    C.groups.forEach(g => {
      const grp = document.createElement('div');
      grp.className = 'grp' + (collapsed[g.id] ? ' collapsed' : '');
      grp.dataset.gid = g.id;
      const nTrack = g.pages.filter(p => p.track).length;
      const countTxt = nTrack ? `${nTrack} video` : '';
      const head = document.createElement('div');
      head.className = 'glabel';
      head.innerHTML = `<span class="chev"></span>` +
        `<span class="gname">${esc(g.label)}</span>` + (countTxt ? `<span class="count">${countTxt}</span>` : '');
      head.addEventListener('click', () => {
        grp.classList.toggle('collapsed');
        collapsed[g.id] = grp.classList.contains('collapsed');
        save(LS_COLL, collapsed);
      });
      grp.appendChild(head);

      const pagesWrap = document.createElement('div');
      pagesWrap.className = 'pages';
      g.pages.forEach(p => {
        const a = document.createElement('a');
        a.className = 'navlink' + (p.important ? ' important' : '');
        a.dataset.id = p.id;
        a.href = '#' + p.id;
        a.innerHTML = `<span class="dot"></span>` +
          `<span class="t">Bài ${p.n}. ${esc(p.title)}</span>` +
          `<span class="dur">${esc(p.dur || '')}</span>`;
        a.addEventListener('click', e => { e.preventDefault(); go(p.id); closeDrawer(); });
        pagesWrap.appendChild(a);
      });
      grp.appendChild(pagesWrap);
      nav.appendChild(grp);
    });
  }

  // ---- Hiển thị 1 bài (video) ----
  const contentEl = document.getElementById('content');
  const topTitle = document.getElementById('topTitle');
  const topProg = document.getElementById('topProg');

  function go(id, push) {
    const idx = flat.findIndex(p => p.id === id);
    if (idx < 0) return;
    const p = flat[idx];
    const prev = flat[idx - 1];
    const next = flat[idx + 1];

    // trình phát video
    let html = `<div class="content-wrap${p.important ? ' imp-page' : ''}">`;
    html += `<div class="player">` +
      `<video controls playsinline preload="metadata" poster="${escAttr(p.poster)}">` +
      `<source src="${escAttr(p.video)}" type="video/mp4">` +
      `Trình duyệt không hỗ trợ phát video.</video></div>`;

    html += `<h1 class="vtitle">Bài ${p.n}. ${esc(p.title)}</h1>`;
    html += `<div class="vmeta">`;
    if (p.important) html += `<span class="badge imp">⭐ Bài quan trọng</span>`;
    html += `<span class="badge">${esc(p.group.label)}</span>` +
      `<span class="badge">Video ${p.n}/${TOTAL}</span>` +
      (p.dur ? `<span class="badge">${esc(p.dur)}</span>` : '') +
      `</div>`;

    // thanh điều hướng trước / tiếp
    html += `<div class="navbtns">`;
    html += prev
      ? `<a class="navbtn prev" href="#${prev.id}" id="prevBtn"><span class="nb-arrow">←</span> Bài trước</a>`
      : `<span class="navbtn disabled">← Bài trước</span>`;
    html += next
      ? `<a class="navbtn next" href="#${next.id}" id="nextBtn">Bài tiếp: ${esc(next.title)} <span class="nb-arrow">→</span></a>`
      : `<span class="navbtn disabled">Bài cuối rồi 🎉</span>`;
    html += `</div>`;

    // đánh dấu đã xem
    const on = !!done[p.id];
    html += `<div class="markbar">` +
      `<button class="markbtn ${on ? 'on' : ''}" id="markBtn">${labelText(on)}</button>` +
      `</div>`;

    html += `</div>`;
    contentEl.innerHTML = html;
    window.scrollTo(0, 0);
    topTitle.textContent = `Bài ${p.n}. ${p.title}`;

    // mở nhóm chứa bài đang xem
    const gEl = nav.querySelector(`.grp[data-gid="${p.group.id}"]`);
    if (gEl && gEl.classList.contains('collapsed')) {
      gEl.classList.remove('collapsed'); collapsed[p.group.id] = false; save(LS_COLL, collapsed);
    }
    document.querySelectorAll('.navlink').forEach(a => a.classList.toggle('active', a.dataset.id === id));

    // nút đánh dấu đã xem
    const mb = document.getElementById('markBtn');
    if (mb) mb.addEventListener('click', () => {
      done[p.id] = !done[p.id]; save(LS_DONE, done);
      mb.classList.toggle('on', done[p.id]); mb.innerHTML = labelText(done[p.id]);
      refreshProgress(); updateTopProg(p);
    });
    // nút trước / tiếp
    const nb = document.getElementById('nextBtn');
    if (nb) nb.addEventListener('click', e => { e.preventDefault(); go(next.id, true); });
    const pb = document.getElementById('prevBtn');
    if (pb) pb.addEventListener('click', e => { e.preventDefault(); go(prev.id, true); });

    if (push !== false) location.hash = id;
    refreshProgress(); updateTopProg(p);
  }

  function labelText(on) { return on ? '✓ Đã xem xong bài này' : 'Đánh dấu đã xem'; }

  // ---- Tiến độ tổng (sidebar) ----
  function refreshProgress() {
    document.querySelectorAll('.navlink').forEach(a => a.classList.toggle('done', !!done[a.dataset.id]));
    const total = trackable.length;
    const d = trackable.filter(p => done[p.id]).length;
    const pct = total ? Math.round(d / total * 100) : 0;
    document.getElementById('bar').style.width = pct + '%';
    document.getElementById('ptxt').textContent = `Đã xem ${d}/${total} bài · ${pct}%`;
  }

  // ---- Tiến trình buổi (topbar) ----
  function updateTopProg(p) {
    const g = p.group;
    const pagesInGroup = g.pages;
    const pos = pagesInGroup.findIndex(x => x.id === p.id) + 1;
    const trackInG = pagesInGroup.filter(x => x.track);
    if (trackInG.length === 0) { topProg.innerHTML = `<span class="tp-label">${esc(g.label)}</span>`; return; }
    const dG = trackInG.filter(x => done[x.id]).length;
    const pct = Math.round(dG / trackInG.length * 100);
    topProg.innerHTML =
      `<span class="tp-label"><b>${esc(g.label)}</b> · Bài ${pos}/${pagesInGroup.length}</span>` +
      `<span class="tp-bar"><i style="width:${pct}%"></i></span>`;
  }

  // ---- Drawer mobile ----
  const app = document.getElementById('app');
  function closeDrawer() { app.classList.remove('open'); }
  document.getElementById('menuBtn').addEventListener('click', () => app.classList.toggle('open'));
  document.getElementById('backdrop').addEventListener('click', closeDrawer);

  // ---- Khởi động ----
  buildNav();
  const start = location.hash.replace('#', '');
  go(flat.some(p => p.id === start) ? start : flat[0].id, false);
  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '');
    if (id && flat.some(p => p.id === id)) go(id, false);
  });
})();
