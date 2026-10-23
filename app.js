(() => {
  const M3 = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const MF = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const ESTADOS = ['Facturado','OC aprobada','Cerrado con OC','Pendiente','Sin estado'];
  const KEYS = ['anio','mes','dc','cliente','estado'];
  const nf = new Intl.NumberFormat('es-CL');
  const clp = (n) => '$' + nf.format(Math.round(n));
  const num = (v, d) => (v).toLocaleString('es-CL', {minimumFractionDigits: 0, maximumFractionDigits: d});
  const mm = (n) => { const v = n / 1e6; return '$' + num(v, Math.abs(v) >= 100 ? 0 : 1) + ' M'; };
  const pc = (x) => num(x * 100, 0) + '%';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmtF = (s) => { const p = s.split('-'); return (p[2] ? (+p[2]) + ' ' : '') + M3[+p[1] - 1] + ' ' + p[0]; };

  const arr = (v) => Array.isArray(v) ? v.map(String) : (v == null || v === '' ? [] : [String(v)]);
  const getF = () => { const p = dash.params(); const f = {}; KEYS.forEach((k) => { f[k] = arr(p[k]); }); return f; };
  const toggle = (k, val) => { const f = getF(); const s = String(val); dash.setParams({[k]: f[k].includes(s) ? f[k].filter((x) => x !== s) : [...f[k], s]}); };
  const pass = (r, f, ...skip) => KEYS.every((k) => skip.includes(k) || !f[k].length || f[k].includes(String(r[k])));
  const sum = (rows) => d3.sum(rows, (r) => r.monto);
  const isFac = (r) => r.estado === 'Facturado';

  const sw = () => { const v = $('vx'); v.style.setProperty('--sw0', dash.colors[0]); v.style.setProperty('--sw1', dash.colors[1]); };
  const nowIdx = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth() + 1; };

  let built = false;
  let sortK = 'fecha', sortDir = -1, query = '', clienteQ = '';
  const chipMaps = {};

  function chip(host, k, val, label) {
    const b = el('button', 'vx-chip', label);
    b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => toggle(k, val));
    host.appendChild(b);
    (chipMaps[k] = chipMaps[k] || []).push({b, val: String(val)});
  }

  function buildStatic(all) {
    const years = [...new Set(all.map((r) => r.anio))].sort();
    years.forEach((y) => chip($('f-anio'), 'anio', y, String(y)));
    M3.forEach((m, i) => chip($('f-mes'), 'mes', i + 1, m));
    const dcs = d3.rollups(all, sum, (r) => r.dc).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    dcs.forEach((d) => chip($('f-dc'), 'dc', d, d));
    ESTADOS.forEach((e) => chip($('f-estado'), 'estado', e, e));
    const cls = d3.rollups(all, sum, (r) => r.cliente).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const list = $('f-cliente-list');
    cls.forEach((c) => {
      const lab = el('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = c;
      cb.addEventListener('change', () => toggle('cliente', c));
      lab.append(cb, el('span', null, c)); lab.dataset.name = c.toLowerCase(); list.appendChild(lab);
    });
    $('f-cliente-q').addEventListener('input', (e) => {
      clienteQ = e.target.value.trim().toLowerCase();
      list.querySelectorAll('label').forEach((l) => { l.hidden = clienteQ && !l.dataset.name.includes(clienteQ); });
    });
    $('vx-reset').addEventListener('click', () => dash.resetParams());
    $('dt-q').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); if (window.vxRender) window.vxRender(); });
    document.querySelectorAll('#dt-table .vx-th').forEach((b) => b.addEventListener('click', () => {
      if (sortK === b.dataset.k) sortDir = -sortDir; else { sortK = b.dataset.k; sortDir = b.dataset.k === 'monto' ? -1 : 1; }
      if (window.vxRender) window.vxRender();
    }));
  }

  function updateFilters(all, f, rowsF) {
    KEYS.forEach((k) => (chipMaps[k] || []).forEach((c) => c.b.setAttribute('aria-pressed', f[k].includes(c.val) ? 'true' : 'false')));
    document.querySelectorAll('#f-cliente-list input').forEach((cb) => { cb.checked = f.cliente.includes(cb.value); });
    $('f-cliente-n').textContent = f.cliente.length ? f.cliente.length + ' seleccionados' : 'Todos';
    $('vx-count').textContent = 'Mostrando ' + nf.format(rowsF.length) + ' de ' + nf.format(all.length) + ' registros. Cada gráfico respeta todos los filtros menos el de su propia dimensión, que queda resaltado.';
  }

  function rankList(host, items, o) {
    host.replaceChildren();
    if (!items.length) { host.appendChild(el('p', 'vx-empty', 'Sin ventas con estos filtros.')); return; }
    const max = d3.max(items, (x) => x.v) || 1;
    const tot = o.total || d3.sum(items, (x) => x.v) || 1;
    items.forEach((x, i) => {
      const b = el('button', 'vx-rrow' + (x.sel ? ' sel' : '') + (o.hasSel && !x.sel ? ' dim' : '')); b.type = 'button';
      b.appendChild(el('span', 'vx-rn', String(i + 1)));
      const l = el('span', 'vx-rl'); const t = el('span', null, x.label);
      if (x.tag) t.appendChild(el('span', 'vx-tag', x.tag));
      l.appendChild(t); if (x.sub) l.appendChild(el('small', null, x.sub)); b.appendChild(l);
      const bar = el('span', 'vx-rb'); const fill = el('i', x.proj ? 'proj' : ''); fill.style.width = Math.max(1.5, x.v / max * 100) + '%';
      fill.style.background = i < (o.accent || 3) ? dash.colors[0] : 'var(--cds-chart-muted)'; bar.appendChild(fill); b.appendChild(bar);
      b.appendChild(el('span', 'vx-rv', mm(x.v))); b.appendChild(el('span', 'vx-rp', pc(x.v / tot)));
      b.addEventListener('click', x.onClick); host.appendChild(b);
    });
  }

  function periodLabel(p, multi) { return MF[p.mes - 1] + (multi ? ' ' + p.anio : ''); }
  function selPeriod(p, f) { return f.mes.includes(String(p.mes)) && (!f.anio.length || f.anio.includes(String(p.anio))); }
  function pickPeriod(p, f) {
    if (selPeriod(p, f) && f.mes.length === 1) dash.setParams({mes: []});
    else dash.setParams({anio: [String(p.anio)], mes: [String(p.mes)]});
  }

  function render(all) {
    sw();
    const f = getF();
    const rowsF = all.filter((r) => pass(r, f));
    updateFilters(all, f, rowsF);
    const rowsM = all.filter((r) => pass(r, f, 'mes'));
    const cur = nowIdx();
    const years = f.anio.length ? f.anio.join(' + ') : 'todos los años';

    // ---- periodos (ranking y evolucion)
    const byP = d3.rollups(rowsM, (v) => ({fac: sum(v.filter(isFac)), pend: sum(v.filter((r) => !isFac(r))), n: v.length}), (r) => r.anio * 100 + r.mes)
      .map(([k, v]) => ({key: k, anio: Math.floor(k / 100), mes: k % 100, ...v, total: v.fac + v.pend}));
    const multi = new Set(byP.map((p) => p.anio)).size > 1;

    // ---- encabezado
    const total = sum(rowsF);
    const bestRow = d3.rollups(rowsF, sum, (r) => r.anio * 100 + r.mes).sort((a, b) => b[1] - a[1])[0];
    const dcRoll = d3.rollups(rowsF, sum, (r) => r.dc).sort((a, b) => b[1] - a[1]);
    if (!rowsF.length) $('vx-take').textContent = 'Ninguna venta cumple los filtros elegidos. Limpia algún filtro para volver a ver datos.';
    else {
      const bm = bestRow[0] % 100, by = Math.floor(bestRow[0] / 100);
      $('vx-take').textContent = years[0].toUpperCase() + years.slice(1) + ': ' + mm(total) + ' netos en ' + nf.format(rowsF.length) + ' registros. ' +
        MF[bm - 1] + (multi || f.anio.length !== 1 ? ' ' + by : '') + ' es el mejor mes con ' + mm(bestRow[1]) + ' y ' + dcRoll[0][0] + ' concentra ' + pc(dcRoll[0][1] / total) + ' de la venta.';
    }
    const act = dash.meta && dash.meta.actualizado ? new Date(dash.meta.actualizado + 'T12:00:00').toLocaleDateString('es-CL', {day: 'numeric', month: 'long', year: 'numeric'}) : '';
    $('vx-meta').textContent = 'Fuente: planilla VENTAS CRV 2026, hojas 2025 y 2026. Montos netos en pesos chilenos.' + (act ? ' Datos al ' + act + '.' : '');

    // ---- KPIs
    const fac = sum(rowsF.filter(isFac)), pend = total - fac;
    const clientes = d3.rollups(rowsF, sum, (r) => r.cliente).sort((a, b) => b[1] - a[1]);
    const top3 = d3.sum(clientes.slice(0, 3), (x) => x[1]);
    const med = d3.median(rowsF, (r) => r.monto) || 0;
    const monthTot = d3.rollups(rowsF, sum, (r) => r.anio * 100 + r.mes).sort((a, b) => b[1] - a[1]);
    const worst = monthTot[monthTot.length - 1];
    const lbl = (k) => M3[k % 100 - 1] + ' ' + Math.floor(k / 100);
    const kp = [
      ['Venta neta', mm(total), nf.format(rowsF.length) + ' registros · ' + years],
      ['Facturado', mm(fac), total ? pc(fac / total) + ' de la venta' : 'Sin ventas'],
      ['Por facturar', mm(pend), 'OC aprobada, cerrado, pendiente y sin estado'],
      ['Ticket promedio', rowsF.length ? mm(total / rowsF.length) : '—', 'Mediana ' + mm(med)],
      ['Clientes activos', nf.format(clientes.length), total ? 'Los 3 mayores suman ' + pc(top3 / total) : 'Sin ventas'],
      ['Mejor mes', bestRow ? lbl(bestRow[0]) : '—', bestRow ? mm(bestRow[1]) + (worst && worst !== monthTot[0] ? ' · peor: ' + lbl(worst[0]) + ' ' + mm(worst[1]) : '') : 'Sin ventas'],
    ];
    $('kpis').replaceChildren(...kp.map((k) => { const d = el('div', 'vx-kpi'); d.append(el('span', 'vx-kl', k[0]), el('span', 'vx-kv', k[1]), el('span', 'vx-ks', k[2])); return d; }));

    // ---- ranking de meses
    const rk = [...byP].sort((a, b) => b.total - a.total);
    $('rm-title').textContent = 'Ranking de meses ' + (f.anio.length ? f.anio.join(' + ') : '');
    $('rm-note').textContent = 'De mejor a peor mes según los demás filtros. Clic en un mes para filtrarlo.';
    const rmTotal = d3.sum(rk, (p) => p.total);
    rankList($('rm-list'), rk.map((p) => {
      const idx = p.anio * 12 + p.mes;
      return {label: periodLabel(p, multi), v: p.total, sel: selPeriod(p, f), proj: idx > cur, tag: idx > cur ? 'Proyectado' : idx === cur ? 'En curso' : '', onClick: () => pickPeriod(p, f)};
    }), {total: rmTotal, hasSel: f.mes.length > 0, accent: 3});

    drawEvo(byP, f, multi);

    // ---- por DC
    const rowsD = all.filter((r) => pass(r, f, 'dc'));
    const dTot = sum(rowsD);
    const dcs = d3.groups(rowsD, (r) => r.dc).map(([dc, v]) => {
      const bm = d3.rollups(v, sum, (r) => r.anio * 100 + r.mes).sort((a, b) => b[1] - a[1])[0];
      return {dc, v: sum(v), n: v.length, cl: new Set(v.map((r) => r.cliente)).size, pend: sum(v.filter((r) => !isFac(r))), best: bm ? lbl(bm[0]) + ' · ' + mm(bm[1]) : ''};
    }).sort((a, b) => b.v - a.v);
    const dtb = $('dc-table').querySelector('tbody'); dtb.replaceChildren();
    const dmax = d3.max(dcs, (d) => d.v) || 1;
    dcs.forEach((d, i) => {
      const tr = el('tr', 'clk' + (f.dc.includes(d.dc) ? ' sel' : '') + (f.dc.length && !f.dc.includes(d.dc) ? ' dim' : ''));
      tr.addEventListener('click', () => toggle('dc', d.dc));
      const c1 = el('td', null, String(i + 1)); const c2 = el('td', null, d.dc);
      const c3 = el('td'); const b = el('span', 'vx-inbar'); b.style.width = Math.max(2, d.v / dmax * 110) + 'px'; b.style.background = i < 3 ? dash.colors[0] : 'var(--cds-chart-muted)';
      c3.append(b, document.createTextNode(' ' + mm(d.v)));
      tr.append(c1, c2, c3, el('td', 'num', pc(d.v / (dTot || 1))), el('td', 'num', nf.format(d.n)), el('td', 'num sec', mm(d.v / d.n)), el('td', 'num sec', nf.format(d.cl)), el('td', 'sec', d.best), el('td', 'num sec', d.pend ? mm(d.pend) : '—'));
      dtb.appendChild(tr);
    });
    const dft = $('dc-table').querySelector('tfoot'); dft.replaceChildren();
    if (dcs.length) { const tr = el('tr'); tr.append(el('td'), el('td', null, 'Total'), el('td', null, mm(dTot)), el('td', 'num', '100%'), el('td', 'num', nf.format(d3.sum(dcs, (d) => d.n))), el('td', 'num sec'), el('td', 'num sec'), el('td', 'sec'), el('td', 'num sec', mm(d3.sum(dcs, (d) => d.pend)))); dft.appendChild(tr); }

    // ---- mapa DC x mes
    const rowsH = all.filter((r) => pass(r, f, 'dc', 'mes'));
    const hm = d3.rollup(rowsH, sum, (r) => r.dc, (r) => r.mes);
    const hdcs = [...hm.keys()].sort((a, b) => d3.sum(hm.get(b).values()) - d3.sum(hm.get(a).values()));
    let hmax = 0; hm.forEach((m) => m.forEach((v) => { hmax = Math.max(hmax, v); }));
    const th = $('hm-table').querySelector('thead'); th.replaceChildren();
    const hr = el('tr'); hr.appendChild(el('th', 'l', 'DC')); M3.forEach((m) => hr.appendChild(el('th', 'num', m))); hr.appendChild(el('th', 'num', 'Total')); th.appendChild(hr);
    const hb = $('hm-table').querySelector('tbody'); hb.replaceChildren();
    hdcs.forEach((dc) => {
      const tr = el('tr', f.dc.includes(dc) ? 'sel' : ''); tr.appendChild(el('td', 'l', dc));
      const mp = hm.get(dc);
      for (let m = 1; m <= 12; m++) {
        const v = mp.get(m) || 0; const td = el('td', v ? 'clk' : '', v ? num(v / 1e6, 1) : '');
        if (v) {
          td.style.background = 'color-mix(in srgb, ' + dash.colors[0] + ' ' + Math.round(Math.sqrt(v / hmax) * 62 + 6) + '%, var(--color-panel))';
          if (f.mes.includes(String(m)) && f.dc.includes(dc)) td.style.outline = '2px solid var(--color-fg)';
          td.addEventListener('click', () => dash.setParams({dc: [dc], mes: [String(m)]}));
        }
        tr.appendChild(td);
      }
      tr.appendChild(el('td', 'num', mm(d3.sum(mp.values())))); hb.appendChild(tr);
    });
    const hf = $('hm-table').querySelector('tfoot'); hf.replaceChildren();
    if (hdcs.length) {
      const tr = el('tr'); tr.appendChild(el('td', 'l', 'Total'));
      for (let m = 1; m <= 12; m++) { const v = d3.sum(hdcs, (dc) => hm.get(dc).get(m) || 0); tr.appendChild(el('td', 'num', v ? num(v / 1e6, 1) : '')); }
      tr.appendChild(el('td', 'num', mm(d3.sum(hdcs, (dc) => d3.sum(hm.get(dc).values()))))); hf.appendChild(tr);
    } else { hb.appendChild(el('tr')).appendChild(el('td', 'vx-empty', 'Sin ventas con estos filtros.')); }

    // ---- top clientes
    const rowsC = all.filter((r) => pass(r, f, 'cliente'));
    const cTot = sum(rowsC);
    const topC = d3.rollups(rowsC, (v) => ({v: sum(v), n: v.length}), (r) => r.cliente).sort((a, b) => b[1].v - a[1].v).slice(0, 10);
    $('tc-note').textContent = 'Participación sobre la venta filtrada. Clic para filtrar un cliente.';
    rankList($('tc-list'), topC.map(([c, o]) => ({label: c, sub: nf.format(o.n) + (o.n === 1 ? ' registro' : ' registros'), v: o.v, sel: f.cliente.includes(c), onClick: () => toggle('cliente', c)})), {total: cTot, hasSel: f.cliente.length > 0, accent: 3});

    // ---- mejores ventas + detalle
    const topV = [...rowsF].sort((a, b) => b.monto - a.monto).slice(0, 10);
    fillRows($('tv-table').querySelector('tbody'), topV, ['cliente','dc','fecha','estado','monto'], true);

    const q = query;
    let det = rowsF.filter((r) => !q || (r.cliente + ' ' + r.proyecto + ' ' + r.dc).toLowerCase().includes(q));
    det = det.sort((a, b) => {
      const x = a[sortK], y = b[sortK];
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
      return (c || a.id - b.id) * sortDir;
    });
    document.querySelectorAll('#dt-table .vx-th').forEach((b) => b.parentElement.setAttribute('aria-sort', b.dataset.k === sortK ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'));
    document.querySelectorAll('#dt-table .vx-th').forEach((b) => b.setAttribute('aria-sort', b.dataset.k === sortK ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'));
    fillRows($('dt-table').querySelector('tbody'), det, ['fecha','cliente','proyecto','dc','estado','factura','monto'], false);
    const dft2 = $('dt-table').querySelector('tfoot'); dft2.replaceChildren();
    if (det.length) { const tr = el('tr'); tr.append(el('td'), el('td', null, 'Total'), el('td'), el('td'), el('td'), el('td', 'sec'), el('td', 'num', clp(sum(det)))); dft2.appendChild(tr); }
    $('dt-note').textContent = nf.format(det.length) + ' de ' + nf.format(rowsF.length) + ' registros. Clic en un encabezado para ordenar.';
  }
  window.vxRender = null;

  function fillRows(tb, rows, cols, rank) {
    tb.replaceChildren();
    rows.forEach((r, i) => {
      const tr = el('tr'); tr.dataset.key = r.id;
      if (rank) tr.appendChild(el('td', null, String(i + 1)));
      cols.forEach((k) => {
        let td;
        if (k === 'monto') td = el('td', 'num', clp(r.monto));
        else if (k === 'fecha') td = el('td', rank ? 'sec' : '', fmtF(r.fecha));
        else if (k === 'estado') { td = el('td'); td.appendChild(el('span', 'vx-badge ' + (r.estado === 'Facturado' ? 'vx-ok' : r.estado === 'Pendiente' || r.estado === 'OC aprobada' ? 'vx-warn' : 'vx-mute'), r.estado)); }
        else if (k === 'factura') td = el('td', 'sec', r.factura || '');
        else td = el('td', (k === 'cliente' || k === 'proyecto') ? 'wrap' : (k === 'dc' && rank ? 'sec' : ''), r[k]);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    if (!rows.length) { const tr = el('tr'); const td = el('td', 'vx-empty', 'Sin registros con estos filtros.'); td.colSpan = cols.length + (rank ? 1 : 0); tr.appendChild(td); tb.appendChild(tr); }
  }

  function drawEvo(byP, f, multi) {
    const box = $('vx-evo'), holder = box.querySelector('.vx-svgwrap'), tip = box.querySelector('.vx-tip');
    holder.classList.remove('dash-skeleton'); holder.replaceChildren(); tip.hidden = true;
    if (!byP.length) { holder.appendChild(el('p', 'vx-empty', 'Sin ventas con estos filtros.')); return; }
    const mapP = new Map(byP.map((p) => [p.key, p]));
    const periods = [];
    [...new Set(byP.map((p) => p.anio))].sort().forEach((y) => {
      const ms = byP.filter((p) => p.anio === y).map((p) => p.mes);
      for (let m = d3.min(ms); m <= d3.max(ms); m++) periods.push(mapP.get(y * 100 + m) || {key: y * 100 + m, anio: y, mes: m, fac: 0, pend: 0, total: 0, n: 0});
    });
    const W = Math.max(280, holder.clientWidth || 600), H = 250;
    const svg = d3.select(holder).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Venta neta por mes');
    const maxV = d3.max(periods, (p) => p.total) || 1;
    const y = d3.scaleLinear([0, maxV * 1.1], [H - 26, 16]).nice();
    const ticks = y.ticks(4);
    const tf = (v) => v === 0 ? '0' : num(v / 1e6, 0) + ' M';
    const probe = svg.append('text').attr('class', 'vx-tick').style('visibility', 'hidden');
    let lw = 0; ticks.forEach((t) => { probe.text(tf(t)); lw = Math.max(lw, probe.node().getComputedTextLength()); }); probe.remove();
    const L = Math.ceil(lw) + 12, R = 6;
    const x = d3.scaleBand(periods.map((p) => p.key), [L, W - R]).padding(0.22);
    svg.selectAll('line.g').data(ticks).join('line').attr('class', 'g').attr('x1', L).attr('x2', W - R).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-grid)');
    svg.selectAll('text.yt').data(ticks).join('text').attr('class', 'vx-tick yt').attr('x', L - 6).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(tf);
    const step = Math.max(1, Math.ceil(34 / x.step()));
    periods.forEach((p, i) => {
      const sel = !f.mes.length || selPeriod(p, f); const op = sel ? 1 : 0.3;
      const bw = x.bandwidth(), bx = x(p.key);
      if (p.fac > 0) svg.append('rect').attr('x', bx).attr('width', bw).attr('y', y(p.fac)).attr('height', y(0) - y(p.fac)).attr('rx', 2).style('fill', dash.colors[0]).attr('opacity', op);
      if (p.pend > 0) svg.append('rect').attr('x', bx).attr('width', bw).attr('y', y(p.fac + p.pend)).attr('height', y(p.fac) - y(p.fac + p.pend)).attr('rx', 2).style('fill', dash.colors[1]).attr('opacity', op);
      if (p.total > 0 && bw >= 26) svg.append('text').attr('class', 'vx-bl').attr('x', bx + bw / 2).attr('y', y(p.total) - 4).attr('text-anchor', 'middle').text(num(p.total / 1e6, p.total >= 1e7 ? 0 : 1));
      if (i % step === 0) svg.append('text').attr('class', 'vx-tick').attr('x', bx + bw / 2).attr('y', H - 8).attr('text-anchor', 'middle').text(M3[p.mes - 1] + (multi ? ' ' + String(p.anio).slice(2) : ''));
      svg.append('rect').attr('x', x(p.key) - x.step() * 0.11).attr('width', x.step()).attr('y', 0).attr('height', H - 22).attr('fill', 'transparent').style('cursor', 'pointer')
        .on('pointermove', (ev) => {
          tip.replaceChildren();
          tip.appendChild(el('b', null, MF[p.mes - 1] + ' ' + p.anio));
          [['Facturado', p.fac], ['Por facturar', p.pend], ['Total', p.total]].forEach(([a, b]) => { const d = el('div'); d.append(el('span', null, a), el('span', null, mm(b))); tip.appendChild(d); });
          tip.hidden = false;
          const r = box.getBoundingClientRect();
          tip.style.left = Math.max(0, Math.min(ev.clientX - r.left + 12, box.clientWidth - tip.offsetWidth)) + 'px';
        })
        .on('pointerleave', () => { tip.hidden = true; })
        .on('click', () => pickPeriod(p, f));
    });
  }

  let lastOk = null, wasBusy = true;
  $('vx-refresh').addEventListener('click', () => dash.refresh('ventas'));
  dash.onData(() => {
    const s1 = dash.data('ventas');
    const busy = !!(s1.refreshing || s1.status === 'loading');
    const btn = $('vx-refresh'); btn.disabled = busy; btn.textContent = busy ? 'Actualizando…' : 'Actualizar datos';
    if (!busy && wasBusy && s1.status === 'ok') lastOk = new Date();
    wasBusy = busy;
    $('vx-upd').textContent = lastOk ? 'Datos leídos a las ' + lastOk.toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'}) : '';
    if (s1.status === 'error' && !built) {
      $('vx-take').textContent = 'No se pudieron cargar las ventas. Revisa tu conexión e intenta de nuevo.';
      return;
    }
    const d = dash.data('ventas');
    if (d.status !== 'ok') return;
    const all = d.data.map((r) => ({...r, monto: Number(r.monto), anio: Number(r.anio), mes: Number(r.mes), id: Number(r.id)}));
    if (!built) { buildStatic(all); built = true; }
    const ul = document.querySelector('#notas ul');
    ul.querySelectorAll('li.vx-extra').forEach((n) => n.remove());
    ((dash.meta && dash.meta.notas) || []).forEach((t) => { const li = el('li', 'vx-extra', t); ul.appendChild(li); });
    window.vxRender = () => render(all);
    render(all);
  });
})();
