/*
 * dash-shim.js
 * Reemplaza, para GitHub Pages, el objeto `dash` que el entorno original
 * entregaba al dashboard (dash.data, dash.onData, dash.params, ...).
 *
 * Los datos NO están en este sitio: se piden a la aplicación web de Apps Script
 * (window.CRV_URL), que solo los entrega si recibe la clave correcta.
 * La clave se mantiene únicamente en memoria: al recargar la página se vuelve a pedir.
 */
(function () {
  'use strict';

  var DEFAULTS = { anio: ['2026'], mes: [], dc: [], cliente: [], estado: [] };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var params = clone(DEFAULTS);
  var listeners = [];
  var store = { ventas: { status: 'locked', data: [], refreshing: false } };
  var claveActual = null;

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { console.error(e); }
    });
  }

  /** Pide los datos a Apps Script. Siempre resuelve con {ok, error?, filas?, actualizado?}. */
  function pedir(clave) {
    var base = String(window.CRV_URL || '');
    if (base.indexOf('https://') !== 0) return Promise.resolve({ ok: false, error: 'config' });
    var url = base + (base.indexOf('?') < 0 ? '?' : '&') + 'clave=' + encodeURIComponent(clave) + '&t=' + Date.now();
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .catch(function (e) {
        console.error('No se pudo contactar la aplicación de datos', e);
        return { ok: false, error: 'red' };
      });
  }

  function aceptar(res) {
    dash.meta = { actualizado: res.actualizado || '', notas: res.notas || [] };
    store.ventas = { status: 'ok', data: res.filas || [], refreshing: false };
  }

  var dash = {
    colors: ['var(--dash-c0)', 'var(--dash-c1)', 'var(--dash-c2)', 'var(--dash-c3)',
             'var(--dash-c4)', 'var(--dash-c5)', 'var(--dash-c6)', 'var(--dash-c7)'],
    meta: {},
    data: function (id) {
      return store[id] || { status: 'missing', data: [], refreshing: false };
    },
    onData: function (fn) { listeners.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params: function () { return clone(params); },
    setParams: function (p) { Object.keys(p).forEach(function (k) { params[k] = p[k]; }); notify(); },
    resetParams: function () { params = clone(DEFAULTS); notify(); },
    setLink: function () {},

    /** Verifica la clave y, si es correcta, carga los datos. */
    unlock: function (clave) {
      return pedir(clave).then(function (res) {
        if (res && res.ok) { claveActual = clave; aceptar(res); notify(); }
        return res || { ok: false, error: 'servidor' };
      });
    },

    /** Vuelve a pedir los datos con la clave ya ingresada. */
    refresh: function () {
      if (!claveActual) return Promise.resolve();
      var started = Date.now();
      store.ventas = { status: store.ventas.status, data: store.ventas.data, refreshing: true };
      notify();
      return pedir(claveActual).then(function (res) {
        var wait = Math.max(0, 450 - (Date.now() - started));
        return new Promise(function (ok) { setTimeout(ok, wait); }).then(function () {
          if (res && res.ok) aceptar(res);
          else store.ventas = { status: store.ventas.status, data: store.ventas.data, refreshing: false };
          notify();
        });
      });
    }
  };
  window.dash = dash;

  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(notify, 150); });
})();
