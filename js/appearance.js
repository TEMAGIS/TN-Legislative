// ════════════════════════════════════════════════════════════════
//  APPEARANCE — Edit tab section where staff choose map symbols, colors and census icons.
//  Changes preview live; "Save for everyone" writes them to the shared settings item.
// ════════════════════════════════════════════════════════════════
const Appearance = (() => {
  const cap = (k) => k.charAt(0).toUpperCase() + k.slice(1);
  const catList = () => (S.cikr ? S.cikr.categories : []);
  const catColor = (c) => (S.cikr.color[c] || '#4d4d4d');

  function html() {
    const cats = catList();
    let h = `<h2 class="sec">Appearance</h2><details id="appear" class="appear"${S.appearOpen ? ' open' : ''}><summary>Map symbols, colors and census icons</summary>
      <p class="muted" style="margin:8px 0">Changes preview here right away. Nothing is shared until you press <b>Save for everyone</b>.</p>`;
    h += '<h3 class="ap-h">Infrastructure symbols</h3>';
    if (!cats.length) h += '<div class="muted"><span class="spin"></span>Loading categories…</div>';
    h += cats.map((c, i) => `<div class="ap-row" data-kind="sym" data-i="${i}">
        <button type="button" class="ap-pv" data-pick title="Choose a symbol">${Symbols.badge(c, catColor(c), 28)}</button>
        <span class="ap-name">${esc(c)}</span>
        <input type="color" class="ap-color" value="${esc(catColor(c))}" aria-label="Color for ${esc(c)}">
        <button type="button" class="btn btn-sm" data-reset title="Back to the default symbol and color">Reset</button></div>`).join('');
    h += '<h3 class="ap-h">District colors</h3><div class="ap-chambers">' + Object.entries(CONFIG.chambers).map(([k, c]) =>
      `<label class="ap-ch"><input type="color" data-ch="${k}" value="${esc(chamberColor(k))}"> ${esc(c.short)}</label>`).join('') + '<button type="button" class="btn btn-sm" id="ap-ch-reset">Reset</button></div>';
    let grp = '';
    Settings.SLOTS.forEach((s, i) => {
      if (s.group !== grp) { grp = s.group; h += `<h3 class="ap-h">${esc(grp)} <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">icon${s.sec ? '' : ', label, visibility'}</span></h3>`; }
      const ic = Settings.icon(s.key) || s.icon;
      h += `<div class="ap-row" data-kind="ico" data-i="${i}">
        <button type="button" class="ap-pv ap-ico" data-pick title="Choose an icon">${Icons.svg(ic, 22)}</button>
        <input type="text" class="ap-label" value="${esc(Settings.data.census.labels[s.key] || '')}" placeholder="${esc(s.label)}" aria-label="Label for ${esc(s.label)}">
        ${s.sec ? '' : `<label class="ap-show"><input type="checkbox" ${Settings.hidden(s.key) ? '' : 'checked'}> Show</label>`}
        <button type="button" class="btn btn-sm" data-reset>Reset</button></div>`;
    });
    h += `<div class="btn-row ap-actions"><button type="button" class="btn btn-primary" id="ap-save">Save for everyone</button>
      <button type="button" class="btn" id="ap-reset-all">Reset all to defaults</button>
      <button type="button" class="btn" id="ap-export">Export JSON</button>
      <label class="btn" for="ap-import" style="cursor:pointer">Import JSON</label><input id="ap-import" type="file" accept="application/json,.json" hidden></div>
      <div id="ap-status" class="muted" role="status"></div></details>`;
    return h;
  }

  function wire(body) {
    const root = $('#appear', body); if (!root) return;
    const status = () => { $('#ap-status', root).textContent = (Settings.dirty ? 'Unsaved changes — only you can see them. ' : '') + 'Source: ' + Settings.source + (Settings.itemId ? ' (item ' + Settings.itemId + ')' : '') + (Settings.loadError ? ' · could not read shared item: ' + Settings.loadError : '') + '.'; };
    status();
    root.addEventListener('toggle', () => { S.appearOpen = root.open; });
    const refreshMap = () => { if (!S.cikr) return; Object.keys(S.cikr.color).forEach(k => { S.cikr.color[k] = Settings.color(k) || S.cikr.defColor[k]; }); renderCikrMarkers(); };
    const refreshRow = (row) => {   // update only the preview, never re-render (keeps focus while typing)
      if (row.dataset.kind === 'sym') { const c = catList()[row.dataset.i]; $('.ap-pv', row).innerHTML = Symbols.badge(c, catColor(c), 28); $('.ap-color', row).value = catColor(c); }
      else { const s = Settings.SLOTS[row.dataset.i]; $('.ap-pv', row).innerHTML = Icons.svg(Settings.icon(s.key) || s.icon, 22); }
    };
    const closePicker = () => { const p = $('.ap-picker', root); if (p) p.remove(); };
    root.addEventListener('click', (e) => {
      const row = e.target.closest('.ap-row');
      if (e.target.closest('[data-pick]') && row) {
        const open = row.nextElementSibling && row.nextElementSibling.classList.contains('ap-picker'); closePicker(); if (open) return;
        const sym = row.dataset.kind === 'sym', c = sym ? catList()[row.dataset.i] : null, slot = sym ? null : Settings.SLOTS[row.dataset.i];
        const keys = sym ? Symbols.keys() : Icons.keys(), cur = sym ? Symbols.keyFor(c) : (Settings.icon(slot.key) || slot.icon);
        const pk = document.createElement('div'); pk.className = 'ap-picker';
        pk.innerHTML = keys.map(k => `<button type="button" data-k="${k}" title="${cap(k)}" aria-label="${cap(k)}" aria-pressed="${k === cur}" class="${k === cur ? 'on' : ''}">${sym ? Symbols.badge(c, catColor(c), 30, true, k) : Icons.svg(k, 22)}</button>`).join('');
        row.after(pk); return;
      }
      const pb = e.target.closest('.ap-picker button[data-k]');
      if (pb) {
        const row2 = pb.closest('.ap-picker').previousElementSibling, k = pb.dataset.k;
        if (row2.dataset.kind === 'sym') { Settings.setSymbol(catList()[row2.dataset.i], k); refreshMap(); } else Settings.setIcon(Settings.SLOTS[row2.dataset.i].key, k);
        refreshRow(row2); closePicker(); status(); return;
      }
      if (e.target.closest('[data-reset]') && row) {
        if (row.dataset.kind === 'sym') { const c = catList()[row.dataset.i]; Settings.setSymbol(c, null); Settings.setColor(c, null); refreshMap(); }
        else { const s = Settings.SLOTS[row.dataset.i]; Settings.setIcon(s.key, null); Settings.setLabel(s.key, null); Settings.setHidden(s.key, false); $('.ap-label', row).value = ''; const cb = $('.ap-show input', row); if (cb) cb.checked = true; }
        refreshRow(row); status(); return;
      }
    });
    root.addEventListener('input', (e) => {
      const t = e.target, row = t.closest('.ap-row');
      if (t.classList.contains('ap-color') && row) { Settings.setColor(catList()[row.dataset.i], t.value); refreshMap(); refreshRow(row); }
      else if (t.classList.contains('ap-label') && row) Settings.setLabel(Settings.SLOTS[row.dataset.i].key, t.value.trim());
      else if (t.dataset.ch) { Settings.setChamberColor(t.dataset.ch, t.value === CONFIG.chambers[t.dataset.ch].color ? null : t.value); restyle(); }
      status();
    });
    root.addEventListener('change', (e) => {
      const t = e.target, row = t.closest('.ap-row');
      if (row && t.type === 'checkbox') { Settings.setHidden(Settings.SLOTS[row.dataset.i].key, !t.checked); status(); }
    });
    const busy = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (err) { onFatal(err); } finally { btn.disabled = false; } };
    $('#ap-ch-reset', root).onclick = () => { Object.keys(CONFIG.chambers).forEach(k => Settings.setChamberColor(k, null)); $$('[data-ch]', root).forEach(i => { i.value = chamberColor(i.dataset.ch); }); restyle(); status(); };
    $('#ap-reset-all', root).onclick = () => { if (!confirm('Reset every symbol, color and icon to the built-in defaults? (Not shared until you save.)')) return; Settings.reset(); refreshMap(); restyle(); S.appearOpen = true; renderDetail(); };
    $('#ap-save', root).onclick = (e) => busy(e.currentTarget, async () => {
      try { const wasNew = !Settings.itemId; await Settings.save(); toast(wasNew ? 'Saved — created the shared settings item.' : 'Saved for everyone.'); status(); }
      catch (err) { toast('Could not save to ArcGIS Online (' + err.message + '). Use Export JSON and commit it as data/settings.json instead.', true); }
    });
    $('#ap-export', root).onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Settings.exportJSON()], { type: 'application/json' })); a.download = 'settings.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('#ap-import', root).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { Settings.importJSON(await f.text()); refreshMap(); restyle(); S.appearOpen = true; renderDetail(); toast('Imported. Press Save for everyone to share it.'); }
      catch { toast('That file is not valid settings JSON.', true); }
    };
  }
  return { html, wire };
})();
