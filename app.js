(() => {
  const M3 = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const MF = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const ESTADOS = ['OK','Cerrado con OC','Pendiente'];
  const PEND = 'Pendiente';
  const OTROS = 'OTROS DCS';
  // Mes de ingreso al equipo (año*12 + mes). El peor mes de un DC se mide desde su ingreso; si no está aquí, desde su primera venta.
  const INGRESO = {'ADRIANA M.': 2026 * 12 + 3, 'ANGELIS C.': 2026 * 12 + 3, 'ANDRES G.': 2026 * 12 + 5};
  const KEYS = ['anio','mes','dc','cliente','estado'];
  const nf = new Intl.NumberFormat('es-CL');
  const clp = (n) => '$' + nf.format(Math.round(n));
  const num = (v, d) => (v).toLocaleString('es-CL', {minimumFractionDigits: 0, maximumFractionDigits: d});
  const mm = (n) => { const v = n / 1e6; return '$' + num(v, Math.abs(v) >= 100 ? 0 : 1) + ' M'; };
  const pc = (x) => num(x * 100, 0) + '%';
  const $ = (id) => document.getElementById(id);
  const setTake = (items) => $('vx-take-list').replaceChildren(...items.map((t) => el('li', null, t)));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmtF = (s) => { const p = s.split('-'); return (p[2] ? (+p[2]) + ' ' : '') + M3[+p[1] - 1] + ' ' + p[0]; };

  const arr = (v) => Array.isArray(v) ? v.map(String) : (v == null || v === '' ? [] : [String(v)]);
  const getF = () => { const p = dash.params(); const f = {}; KEYS.forEach((k) => { f[k] = arr(p[k]); }); return f; };
  const toggle = (k, val) => { const f = getF(); const s = String(val); dash.setParams({[k]: f[k].includes(s) ? f[k].filter((x) => x !== s) : [...f[k], s]}); };
  // Sin filtro de estado, los Pendientes (por facturar) no entran en la venta neta; se ven aparte o al elegir el estado Pendiente.
  const pass = (r, f, ...skip) => KEYS.every((k) => skip.includes(k) || (k === 'estado' && !f.estado.length ? r.estado !== PEND : (!f[k].length || f[k].includes(String(r[k])))));
  const sum = (rows) => d3.sum(rows, (r) => r.monto);
  const isOk = (r) => r.estado === 'OK';
  const isCl = (r) => r.estado === 'Cerrado con OC';
  const isWon = (r) => r.estado !== PEND;
  const dcCmp = (a, b) => (a === OTROS) - (b === OTROS);

  const nowIdx = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth() + 1; };

  let built = false;
  let sortK = 'fecha', sortDir = -1, query = '', clienteQ = '';
  const chipMaps = {};

  function chip(host, k, val, label) {
    const b = el('button', 'vx-chip', label);
    b.type = 'button'; b.setAttribute('aria-pressed', 'false'); if (label === OTROS) b.classList.add('otros');
    b.addEventListener('click', () => toggle(k, val));
    host.appendChild(b);
    (chipMaps[k] = chipMaps[k] || []).push({b, val: String(val)});
  }

  let bound = false, sig = '';
  function buildStatic(all) {
    ['f-anio','f-mes','f-dc','f-estado'].forEach((id) => $(id).replaceChildren());
    $('f-cliente-list').replaceChildren();
    Object.keys(chipMaps).forEach((k) => { chipMaps[k] = []; });
    const years = [...new Set(all.map((r) => r.anio))].sort();
    years.forEach((y) => chip($('f-anio'), 'anio', y, String(y)));
    M3.forEach((m, i) => chip($('f-mes'), 'mes', i + 1, m));
    const dcs = d3.rollups(all, sum, (r) => r.dc).sort((a, b) => dcCmp(a[0], b[0]) || b[1] - a[1]).map((x) => x[0]);
    dcs.forEach((d) => chip($('f-dc'), 'dc', d, d));
    ESTADOS.forEach((e) => chip($('f-estado'), 'estado', e, e));
    const cls = d3.rollups(all, sum, (r) => r.cliente).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const list = $('f-cliente-list');
    cls.forEach((c) => {
      const lab = el('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = c;
      cb.addEventListener('change', () => toggle('cliente', c));
      lab.append(cb, el('span', null, c)); lab.dataset.name = c.toLowerCase(); list.appendChild(lab);
    });
    if (bound) return;
    bound = true;
    $('f-cliente-q').addEventListener('input', (e) => {
      clienteQ = e.target.value.trim().toLowerCase();
      $('f-cliente-list').querySelectorAll('label').forEach((l) => { l.hidden = clienteQ && !l.dataset.name.includes(clienteQ); });
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
    const conVenta = all.filter(isWon).length, pendTodos = all.length - conVenta;
    $('vx-count').textContent = f.estado.length ? 'Mostrando ' + nf.format(rowsF.length) + ' de ' + nf.format(all.length) + ' registros. Cada gráfico respeta todos los filtros menos el de su propia dimensión, que queda resaltado.'
      : 'Mostrando ' + nf.format(rowsF.length) + ' de ' + nf.format(conVenta) + ' registros con venta · ' + nf.format(pendTodos) + ' pendientes aparte. Cada gráfico respeta todos los filtros menos el de su propia dimensión, que queda resaltado.';
  }

  function rankList(host, items, o) {
    host.replaceChildren();
    if (!items.length) { host.appendChild(el('p', 'vx-empty', 'Sin ventas con estos filtros.')); return; }
    const max = d3.max(items, (x) => x.v) || 1;
    const tot = o.total || d3.sum(items, (x) => x.v) || 1;
    items.forEach((x, i) => {
      const b = el('button', 'vx-rrow' + (x.sel ? ' sel' : '') + (o.hasSel && !x.sel ? ' dim' : '')); b.type = 'button';
      b.appendChild(el('span', 'vx-rn', x.proj ? '·' : String(x.rank || i + 1)));
      const l = el('span', 'vx-rl'); const t = el('span', null, x.label);
      if (x.tag) t.appendChild(el('span', 'vx-tag' + (x.now ? ' now' : ''), x.tag));
      l.appendChild(t); if (x.sub) l.appendChild(el('small', null, x.sub)); b.appendChild(l);
      const bar = el('span', 'vx-rb'); const fill = el('i', x.proj ? 'proj' : ''); fill.style.width = Math.max(1.5, x.v / max * 100) + '%';
      fill.style.background = (!x.proj && i < (o.accent || 3)) ? 'var(--brand-blue)' : x.proj ? 'var(--brand-orange)' : 'var(--chart-muted)'; bar.appendChild(fill); b.appendChild(bar);
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
    const f = getF();
    const rowsF = all.filter((r) => pass(r, f));
    updateFilters(all, f, rowsF);
    const rowsM = all.filter((r) => pass(r, f, 'mes'));
    const cur = nowIdx();
    const elapsed = (k) => Math.floor(k / 100) * 12 + (k % 100) <= cur;   // mes ya iniciado
    const years = f.anio.length ? f.anio.join(' + ') : 'todos los años';

    // ---- periodos (ranking y evolucion)
    // el gráfico muestra también los pendientes (por facturar) aunque no estén filtrados; la venta neta (vn) no los incluye
    const rowsMc = f.estado.length ? rowsM : rowsM.concat(all.filter((r) => pass(r, f, 'mes', 'estado') && !isWon(r)));
    const byP = d3.rollups(rowsMc, (v) => ({ok: sum(v.filter(isOk)), cl: sum(v.filter(isCl)), pe: sum(v.filter((r) => !isWon(r))), n: v.length}), (r) => r.anio * 100 + r.mes)
      .map(([k, v]) => ({key: k, anio: Math.floor(k / 100), mes: k % 100, ...v, total: v.ok + v.cl + v.pe, vn: v.ok + v.cl + (f.estado.includes(PEND) ? v.pe : 0)}));
    const multi = new Set(byP.map((p) => p.anio)).size > 1;

    // ---- mejor / peor mes: solo meses transcurridos; el peor, solo meses completos (sin el mes en curso)
    const total = sum(rowsF);
    const monthAll = d3.rollups(rowsF, sum, (r) => r.anio * 100 + r.mes);
    const idxOf = (k) => Math.floor(k / 100) * 12 + (k % 100);
    const monthTot = monthAll.filter((x) => elapsed(x[0])).sort((a, b) => b[1] - a[1]);
    const bestRow = monthTot[0];
    // peor mes: se evalúan todos los meses completos desde el primer mes con ventas (ingreso del DC o inicio del período),
    // incluyendo los meses sin ventas, que cuentan como $0
    let worst = null;
    if (monthAll.length) {
      const tot = new Map(monthAll.map(([k, v]) => [idxOf(k), v]));
      const firstSale = (rows) => d3.min(rows, (r) => r.anio * 12 + r.mes);
      const start = f.dc.length ? d3.min(f.dc, (dc) => INGRESO[dc] || firstSale(rowsF.filter((r) => r.dc === dc)) || Infinity) : d3.min([...tot.keys()]);
      const lastYr = f.anio.length ? d3.max(f.anio.map(Number)) * 12 + 12 : Infinity;
      const end = Math.min(cur - 1, lastYr);
      const cand = [];
      for (let i = start; i <= end; i++) {
        const mo = ((i - 1) % 12) + 1, yr = Math.floor((i - 1) / 12);
        if (f.mes.length && !f.mes.includes(String(mo))) continue;
        if (f.anio.length && !f.anio.includes(String(yr))) continue;
        cand.push({k: yr * 100 + mo, v: tot.get(i) || 0});
      }
      if (cand.length > 1) worst = cand.reduce((a, b) => (b.v < a.v ? b : a));
    }
    const lbl = (k) => M3[k % 100 - 1] + ' ' + Math.floor(k / 100);
    const dcRoll = d3.rollups(rowsF, sum, (r) => r.dc).sort((a, b) => dcCmp(a[0], b[0]) || b[1] - a[1]);
    const oneMonth = f.mes.length === 1 && f.anio.length === 1;
    const selIdx = oneMonth ? (+f.anio[0]) * 12 + (+f.mes[0]) : 0;

    // ---- datos de proyección: ignoran el filtro de estado
    const allE = all.filter((r) => pass(r, f, 'estado'));
    const seg = sum(allE.filter(isCl)), conf = sum(allE.filter((r) => !isWon(r)));
    const segN = allE.filter(isCl).length, confN = allE.filter((r) => !isWon(r)).length;
    const regs = (n) => nf.format(n) + (n === 1 ? ' registro' : ' registros');

    // ---- encabezado (Datos clave)
    const yTxt = years[0].toUpperCase() + years.slice(1);
    if (!rowsF.length) {
      setTake(conf > 0 && !f.estado.includes(PEND)
        ? [yTxt + ': sin ventas cerradas con estos filtros.', mm(conf) + ' por facturar en ' + regs(confN) + ' (pendientes).']
        : ['Ninguna venta cumple los filtros elegidos. Limpia algún filtro para volver a ver datos.']);
    } else {
      const t = [yTxt + ': ' + mm(total) + ' netos en ' + regs(rowsF.length) + '.'];
      if (oneMonth) {
        const top = [...rowsF].sort((a, b) => b.monto - a.monto)[0];
        t.push('La mayor venta de ' + MF[+f.mes[0] - 1].toLowerCase() + ' fue ' + top.cliente + ', ' + mm(top.monto) + '.');
      } else if (bestRow) {
        const bm = bestRow[0] % 100, by = Math.floor(bestRow[0] / 100);
        t.push(MF[bm - 1] + (multi || f.anio.length !== 1 ? ' ' + by : '') + ' es el mejor mes con ' + mm(bestRow[1]) + '.');
      }
      const dAll = sum(all.filter((r) => pass(r, f, 'dc')));
      if (f.dc.length === 1) t.push(f.dc[0] + ' es ' + pc(total / (dAll || 1)) + ' de la venta de todos los DC.');
      else if (f.dc.length > 1) t.push('Los DC elegidos suman ' + pc(total / (dAll || 1)) + ' de la venta de todos los DC.');
      else { const lead = dcRoll.find((x) => x[0] !== OTROS); if (lead) t.push(lead[0] + ' concentra ' + pc(lead[1] / total) + ' de la venta.'); }
      setTake(t);
    }
    const act = dash.meta && dash.meta.actualizado ? new Date(dash.meta.actualizado + 'T12:00:00').toLocaleDateString('es-CL', {day: 'numeric', month: 'long', year: 'numeric'}) : '';
    // años y pestañas según los datos recibidos, para que una pestaña nueva (2027, 2028...) se refleje sola
    const yAll = [...new Set(all.map((r) => r.anio))].sort();
    const hojas = [...new Set(all.map((r) => String(r.hoja || r.anio)))].sort();
    const listaY = (xs) => xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs.join('');
    $('vx-eyebrow').textContent = 'Panel comercial · ' + (yAll.length > 1 ? yAll[0] + '–' + yAll[yAll.length - 1] : yAll.join(''));
    $('vx-meta').textContent = 'Fuente: planilla VENTAS CRV 2026, hojas ' + listaY(hojas) + '. Montos netos en pesos chilenos.' + (act ? ' Datos al ' + act + '.' : '');

    // ---- línea de contexto
    const ctx = [f.anio.length ? f.anio.join(' + ') : 'todos los años'];
    if (f.mes.length) ctx.push(f.mes.map((m) => MF[+m - 1]).join(', '));
    if (f.dc.length) ctx.push(f.dc.join(', '));
    if (f.cliente.length) ctx.push(f.cliente.length === 1 ? f.cliente[0] : f.cliente.length + ' clientes');
    ctx.push('Estado: ' + (f.estado.length ? f.estado.join(' + ') : 'OK y Cerrado con OC'));
    $('vx-ctx').textContent = 'Viendo: ' + ctx.join(' · ');

    // ---- KPIs
    const ok = sum(rowsF.filter(isOk)), cl = sum(rowsF.filter(isCl));
    const cierres = new Set(rowsF.filter(isWon).map((r) => r.cliente)).size;
    const med = d3.median(rowsF, (r) => r.monto) || 0;
    const heroT = (() => {
      const e = f.estado;
      if (!e.length || (e.length === 2 && e.includes('OK') && e.includes('Cerrado con OC'))) return 'Venta neta';
      if (e.length === 1) return e[0] === 'OK' ? 'Ventas OK' : e[0] === 'Cerrado con OC' ? 'Cerrado con OC' : 'Por facturar (pendientes)';
      return 'Venta neta + pendientes';
    })();
    let mesK;
    if (oneMonth) {
      const prevIdx = selIdx - 1, py = Math.floor((prevIdx - 1) / 12), pm = ((prevIdx - 1) % 12) + 1;
      const prevTot = sum(all.filter((r) => pass(r, f, 'mes', 'anio') && r.anio * 12 + r.mes === prevIdx));
      const sub = prevTot > 0 ? (total >= prevTot ? '+' : '−') + pc(Math.abs(total - prevTot) / prevTot) + ' vs ' + M3[pm - 1] + ' ' + py : 'Sin ventas en ' + M3[pm - 1] + ' ' + py + ' para comparar';
      mesK = ['Mes seleccionado', M3[+f.mes[0] - 1] + ' ' + f.anio[0], mm(total) + ' · ' + sub + (selIdx === cur ? ' · mes en curso, parcial' : ''), '', 'var(--brand-orange)'];
    } else {
      mesK = ['Mejor y peor mes', '', '', '', 'var(--brand-orange)', [
        ['Mejor mes', bestRow ? lbl(bestRow[0]) : '—', bestRow ? mm(bestRow[1]) : ''],
        ['Peor mes', worst ? lbl(worst.k) : '—', worst ? (worst.v === 0 ? 'Sin ventas' : mm(worst.v)) : '']]];
    }
    const share = (v) => total ? pc(v / total) + ' de la venta' : 'Sin ventas';
    const kp = [
      [heroT, mm(total), regs(rowsF.length) + ' · ' + years, 'hero', 'var(--brand-orange)'],
      ['Cierres ganados', nf.format(cierres), 'Clientes con OK o cerrado con OC · ' + mm(ok + cl), '', 'var(--brand-green)'],
      ['Ventas OK', mm(ok), share(ok), '', 'var(--st-ok)'],
      ['Ticket promedio', rowsF.length ? mm(total / rowsF.length) : '—', 'Mediana ' + mm(med), '', 'var(--brand-blue)'],
      mesK,
      ['Proyección segura', mm(seg), 'Cerrado con OC · ' + regs(segN), '', 'var(--st-cl)'],
      ['Proyección por confirmar', mm(conf), 'Pendiente · ' + regs(confN) + ' · incluye sin estado', '', 'var(--st-pe)'],
      ['Flujo proyectado total', mm(seg + conf), 'Segura ' + mm(seg) + ' + por confirmar ' + mm(conf), 'full', 'var(--brand-blue)'],
    ];
    $('kpis').replaceChildren(...kp.map((k) => { const d = el('div', 'vx-kpi' + (k[3] ? ' ' + k[3] : '')); d.style.setProperty('--k', k[4]); d.append(el('span', 'vx-kl', k[0]));
      if (k[5]) k[5].forEach((r) => { const row = el('div', 'vx-mrow'); row.append(el('span', 'vx-mt', r[0]), el('span', 'vx-mm', r[1]), el('span', 'vx-ma', r[2])); d.appendChild(row); });
      else d.append(el('span', 'vx-kv', k[1]), el('span', 'vx-ks', k[2]));
      return d; }));

    // ---- ranking de meses: transcurridos de mejor a peor, luego los futuros (proyectados)
    const rkP = byP.filter((p) => p.vn > 0);
    const past = rkP.filter((p) => elapsed(p.key)).sort((a, b) => b.vn - a.vn);
    const fut = rkP.filter((p) => !elapsed(p.key)).sort((a, b) => a.key - b.key);
    $('rm-title').textContent = 'Ranking de meses · ' + (f.anio.length ? f.anio.join(' + ') : 'todos los años');
    $('rm-note').textContent = 'De mejor a peor entre los meses transcurridos. Los meses futuros van al final como proyectados. Clic en un mes para filtrarlo.';
    const rmTotal = d3.sum(rkP, (p) => p.vn);
    rankList($('rm-list'), [...past, ...fut].map((p) => {
      const idx = p.anio * 12 + p.mes;
      return {label: periodLabel(p, multi), v: p.vn, sel: selPeriod(p, f), proj: idx > cur, now: idx === cur, tag: idx > cur ? 'Proyectado' : idx === cur ? 'En curso' : '', onClick: () => pickPeriod(p, f)};
    }), {total: rmTotal, hasSel: f.mes.length > 0, accent: 3});

    drawEvo(byP, f, multi, elapsed);

    // ---- por DC (OTROS DCS siempre al final)
    const rowsD = all.filter((r) => pass(r, f, 'dc'));
    const dTot = sum(rowsD);
    const dcs = d3.groups(rowsD, (r) => r.dc).map(([dc, v]) => {
      const bm = d3.rollups(v, sum, (r) => r.anio * 100 + r.mes).filter((x) => elapsed(x[0])).sort((a, b) => b[1] - a[1])[0];
      const top1 = [...v].sort((a, b) => b.monto - a.monto)[0];
      return {dc, v: sum(v), n: v.length, cl: new Set(v.map((r) => r.cliente)).size, cierre: sum(v.filter(isCl)), pend: sum(v.filter((r) => !isWon(r))), best: oneMonth ? (top1 ? top1.cliente + ' · ' + mm(top1.monto) : '') : bm ? lbl(bm[0]) + ' · ' + mm(bm[1]) : ''};
    }).sort((a, b) => dcCmp(a.dc, b.dc) || b.v - a.v);
    $('dc-th-best').textContent = oneMonth ? 'Mayor venta del mes' : 'Mejor mes';
    const dtb = $('dc-table').querySelector('tbody'); dtb.replaceChildren();
    const dmax = d3.max(dcs, (d) => d.v) || 1;
    dcs.forEach((d, i) => {
      const tr = el('tr', 'clk' + (f.dc.includes(d.dc) ? ' sel' : '') + (f.dc.length && !f.dc.includes(d.dc) ? ' dim' : ''));
      tr.addEventListener('click', () => toggle('dc', d.dc));
      const c1 = el('td', null, d.dc === OTROS ? '·' : String(i + 1)); const c2 = el('td', null, d.dc);
      const c3 = el('td'); const b = el('span', 'vx-inbar'); b.style.width = Math.max(2, d.v / dmax * 110) + 'px'; b.style.background = d.dc !== OTROS && i < 3 ? 'var(--brand-blue)' : 'var(--chart-muted)';
      c3.append(b, document.createTextNode(' ' + mm(d.v)));
      tr.append(c1, c2, c3, el('td', 'num', pc(d.v / (dTot || 1))), el('td', 'num', nf.format(d.n)), el('td', 'num sec', mm(d.v / d.n)), el('td', 'num sec', nf.format(d.cl)), el('td', 'sec', d.best), el('td', 'num sec', d.cierre ? mm(d.cierre) : '—'));
      dtb.appendChild(tr);
    });
    const dft = $('dc-table').querySelector('tfoot'); dft.replaceChildren();
    if (dcs.length) { const tr = el('tr'); tr.append(el('td'), el('td', null, 'Total'), el('td', null, mm(dTot)), el('td', 'num', '100%'), el('td', 'num', nf.format(d3.sum(dcs, (d) => d.n))), el('td', 'num sec'), el('td', 'num sec'), el('td', 'sec'), el('td', 'num sec', mm(d3.sum(dcs, (d) => d.cierre)))); dft.appendChild(tr); }

    // ---- mapa DC x mes
    const rowsH = all.filter((r) => pass(r, f, 'dc', 'mes'));
    const hm = d3.rollup(rowsH, sum, (r) => r.dc, (r) => r.mes);
    const hdcs = [...hm.keys()].sort((a, b) => dcCmp(a, b) || d3.sum(hm.get(b).values()) - d3.sum(hm.get(a).values()));
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
          td.style.background = 'color-mix(in srgb, var(--brand-blue) ' + Math.round(Math.sqrt(v / hmax) * 62 + 6) + '%, var(--color-panel))';
          if (f.mes.includes(String(m)) && f.dc.includes(dc)) td.style.outline = '2px solid var(--brand-orange)';
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
    // el detalle lista también los pendientes (por facturar) aunque no estén filtrados; el total los muestra aparte
    const detBase = f.estado.length ? rowsF : all.filter((r) => pass(r, f, 'estado'));
    let det = detBase.filter((r) => !q || (r.cliente + ' ' + r.proyecto + ' ' + r.dc).toLowerCase().includes(q));
    det = det.sort((a, b) => {
      const x = a[sortK], y = b[sortK];
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
      return (c || a.id - b.id) * sortDir;
    });
    document.querySelectorAll('#dt-table .vx-th').forEach((b) => b.parentElement.setAttribute('aria-sort', b.dataset.k === sortK ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'));
    document.querySelectorAll('#dt-table .vx-th').forEach((b) => b.setAttribute('aria-sort', b.dataset.k === sortK ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'));
    fillRows($('dt-table').querySelector('tbody'), det, ['fecha','cliente','proyecto','dc','estado','factura','monto'], false);
    const dft2 = $('dt-table').querySelector('tfoot'); dft2.replaceChildren();
    if (det.length) {
      const dPend = sum(det.filter((r) => !isWon(r))), dWon = sum(det) - dPend;
      const tr = el('tr'); tr.append(el('td'), el('td', null, f.estado.includes(PEND) ? 'Total' : 'Venta neta'), el('td'), el('td'), el('td'), el('td', 'sec'), el('td', 'num', clp(f.estado.includes(PEND) ? sum(det) : dWon))); dft2.appendChild(tr);
      if (dPend && !f.estado.includes(PEND)) { const t2 = el('tr'); t2.append(el('td'), el('td', null, 'Pendiente (por facturar)'), el('td'), el('td'), el('td'), el('td', 'sec'), el('td', 'num', clp(dPend))); dft2.appendChild(t2); }
    }
    $('dt-note').textContent = nf.format(det.length) + ' registros' + (detBase.length !== rowsF.length ? ', con los pendientes por facturar' : '') + '. Clic en un encabezado para ordenar.';
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
        else if (k === 'estado') { td = el('td'); td.appendChild(el('span', 'vx-badge ' + (r.estado === 'OK' ? 'vx-ok' : r.estado === 'Cerrado con OC' ? 'vx-blue' : 'vx-warn'), r.estado)); }
        else if (k === 'factura') td = el('td', 'sec', r.factura || '');
        else td = el('td', (k === 'cliente' || k === 'proyecto') ? 'wrap' : (k === 'dc' && rank ? 'sec' : ''), r[k]);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    if (!rows.length) { const tr = el('tr'); const td = el('td', 'vx-empty', 'Sin registros con estos filtros.'); td.colSpan = cols.length + (rank ? 1 : 0); tr.appendChild(td); tb.appendChild(tr); }
  }

  function drawEvo(byP, f, multi, elapsed) {
    const box = $('vx-evo'), holder = box.querySelector('.vx-svgwrap'), tip = box.querySelector('.vx-tip');
    holder.classList.remove('dash-skeleton'); holder.replaceChildren(); tip.hidden = true;
    if (!byP.length) { holder.appendChild(el('p', 'vx-empty', 'Sin ventas con estos filtros.')); return; }
    const mapP = new Map(byP.map((p) => [p.key, p]));
    const periods = [];
    [...new Set(byP.map((p) => p.anio))].sort().forEach((y) => {
      const ms = byP.filter((p) => p.anio === y).map((p) => p.mes);
      for (let m = d3.min(ms); m <= d3.max(ms); m++) periods.push(mapP.get(y * 100 + m) || {key: y * 100 + m, anio: y, mes: m, ok: 0, cl: 0, pe: 0, total: 0, n: 0});
    });
    const W = Math.max(280, holder.clientWidth || 600), H = 250;
    const svg = d3.select(holder).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Venta neta por mes y estado');
    const maxV = d3.max(periods, (p) => p.total) || 1;
    const y = d3.scaleLinear([0, maxV * 1.1], [H - 26, 16]).nice();
    const ticks = y.ticks(4);
    const tf = (v) => v === 0 ? '0' : num(v / 1e6, 0) + ' M';
    const probe = svg.append('text').attr('class', 'vx-tick').style('visibility', 'hidden');
    let lw = 0; ticks.forEach((t) => { probe.text(tf(t)); lw = Math.max(lw, probe.node().getComputedTextLength()); }); probe.remove();
    const L = Math.ceil(lw) + 12, R = 6;
    const x = d3.scaleBand(periods.map((p) => p.key), [L, W - R]).padding(0.22);
    svg.selectAll('line.g').data(ticks).join('line').attr('class', 'g').attr('x1', L).attr('x2', W - R).attr('y1', y).attr('y2', y).style('stroke', 'var(--chart-grid)');
    svg.selectAll('text.yt').data(ticks).join('text').attr('class', 'vx-tick yt').attr('x', L - 6).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(tf);
    const step = Math.max(1, Math.ceil(34 / x.step()));
    periods.forEach((p, i) => {
      const sel = !f.mes.length || selPeriod(p, f); const fut = !elapsed(p.key); const op = (sel ? 1 : 0.3) * (fut ? 0.55 : 1);
      const bw = x.bandwidth(), bx = x(p.key);
      let base = 0;
      [['ok', 'var(--st-ok)'], ['cl', 'var(--st-cl)'], ['pe', 'var(--st-pe)']].forEach(([k, col]) => {
        if (p[k] > 0) svg.append('rect').attr('x', bx).attr('width', bw).attr('y', y(base + p[k])).attr('height', y(base) - y(base + p[k])).attr('rx', 2).style('fill', col).attr('opacity', op);
        base += p[k];
      });
      if (p.total > 0 && bw >= 26) svg.append('text').attr('class', 'vx-bl').attr('x', bx + bw / 2).attr('y', y(p.total) - 4).attr('text-anchor', 'middle').text(num(p.total / 1e6, p.total >= 1e7 ? 0 : 1));
      if (i % step === 0) svg.append('text').attr('class', 'vx-tick').attr('x', bx + bw / 2).attr('y', H - 8).attr('text-anchor', 'middle').text(M3[p.mes - 1] + (multi ? ' ' + String(p.anio).slice(2) : ''));
      svg.append('rect').attr('x', x(p.key) - x.step() * 0.11).attr('width', x.step()).attr('y', 0).attr('height', H - 22).attr('fill', 'transparent').style('cursor', 'pointer')
        .on('pointermove', (ev) => {
          tip.replaceChildren();
          tip.appendChild(el('b', null, MF[p.mes - 1] + ' ' + p.anio + (fut ? ' · proyectado' : '')));
          [['OK', p.ok], ['Proyección segura (cerrado con OC)', p.cl], ['Por confirmar (pendiente)', p.pe], ['Total', p.total]].forEach(([a, b]) => { const d = el('div'); d.append(el('span', null, a), el('span', null, mm(b))); tip.appendChild(d); });
          tip.hidden = false;
          const r = box.getBoundingClientRect();
          tip.style.left = Math.max(0, Math.min(ev.clientX - r.left + 12, box.clientWidth - tip.offsetWidth)) + 'px';
        })
        .on('pointerleave', () => { tip.hidden = true; })
        .on('click', () => pickPeriod(p, f));
    });
  }

  let lastOk = null, wasBusy = true;
  const fmtHora = (d) => d.toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'});
  $('vx-refresh').addEventListener('click', () => dash.refresh('ventas'));
  dash.onData(() => {
    const s1 = dash.data('ventas');
    const busy = !!(s1.refreshing || s1.status === 'loading');
    const btn = $('vx-refresh'); btn.disabled = busy; btn.textContent = busy ? 'Actualizando…' : 'Actualizar ahora';
    $('vx-live').classList.toggle('busy', busy); $('vx-live-t').textContent = busy ? 'Actualizando…' : 'En vivo';
    if (!busy && wasBusy && s1.status === 'ok') lastOk = new Date();
    wasBusy = busy;
    $('vx-upd').textContent = lastOk ? 'Última lectura ' + fmtHora(lastOk) + ' · se actualiza solo cada 5 min' : '';
    if (s1.status === 'error' && !built) {
      setTake(['No se pudieron cargar las ventas. Revisa tu conexión e intenta de nuevo.']);
      return;
    }
    const d = dash.data('ventas');
    if (d.status !== 'ok') return;
    const all = d.data.map((r) => ({...r, monto: Number(r.monto), anio: Number(r.anio), mes: Number(r.mes), id: Number(r.id)}));
    // los filtros se reconstruyen si aparecen años, DC o clientes nuevos en la planilla
    const nuevaFirma = [...new Set(all.map((r) => r.anio + '|' + r.dc + '|' + r.cliente))].sort().join('~');
    if (!built || nuevaFirma !== sig) { buildStatic(all); built = true; sig = nuevaFirma; }
    const ul = document.querySelector('#notas ul');
    ul.querySelectorAll('li.vx-extra').forEach((n) => n.remove());
    ((dash.meta && dash.meta.notas) || []).forEach((t) => { const li = el('li', 'vx-extra', t); ul.appendChild(li); });
    window.vxRender = () => render(all);
    render(all);
  });
})();
