/*
 * acceso.js
 * Pantalla de acceso: muestra la palabra CicloRecreoVía en bloques.
 * La clave es el orden en que se tocan los bloques; se valida en Apps Script,
 * no en esta página, así que aquí no hay nada que descubrir.
 */
(function () {
  'use strict';

  var PALABRA = 'CicloRecreoVía'.normalize('NFC');
  var letras = Array.from(PALABRA);

  var lock = document.getElementById('lock');
  var root = document.getElementById('dash-root');
  var tiles = document.getElementById('lock-tiles');
  var dots = document.getElementById('lock-dots');
  var msg = document.getElementById('lock-msg');
  var box = lock.querySelector('.lock-box');
  var ingresadas = [];
  var ocupado = false;

  var MENSAJES = {
    clave: 'Clave incorrecta. Intenta de nuevo.',
    bloqueado: 'Demasiados intentos. Espera unos 15 minutos.',
    red: 'No se pudo conectar. Revisa tu conexión.',
    config: 'Falta configurar la dirección de datos (config.js).',
    sin_clave: 'La clave aún no está configurada en la planilla.',
    servidor: 'La planilla no respondió. Intenta de nuevo en un momento.'
  };

  letras.forEach(function (ch, i) {
    var b = document.createElement('button');
    b.type = 'button';
    // colores del logo: Ciclo (azul), recreo (naranja), Vía (verde)
    b.className = 'lock-tile' + (i >= 11 ? ' g' : i >= 5 ? ' o' : '');
    b.textContent = ch;
    b.setAttribute('aria-label', ch);
    b.addEventListener('click', function () { tocar(ch); });
    tiles.appendChild(b);
    var d = document.createElement('i');
    dots.appendChild(d);
  });

  function pintar() {
    Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle('on', i < ingresadas.length); });
  }

  function decir(texto, mala) {
    msg.textContent = texto || '';
    msg.classList.toggle('bad', !!mala);
  }

  function bloquear(v) {
    ocupado = v;
    Array.prototype.forEach.call(tiles.children, function (b) { b.disabled = v; });
  }

  function reiniciar() {
    ingresadas = [];
    pintar();
    decir('');
  }

  function tocar(ch) {
    if (ocupado || ingresadas.length >= letras.length) return;
    ingresadas.push(ch);
    pintar();
    if (ingresadas.length === letras.length) enviar();
  }

  function enviar() {
    bloquear(true);
    decir('Verificando…');
    dash.unlock(ingresadas.join('')).then(function (res) {
      if (res && res.ok) {
        lock.hidden = true;
        root.hidden = false;
        window.dispatchEvent(new Event('resize'));
        return;
      }
      ingresadas = [];
      pintar();
      decir(MENSAJES[res && res.error] || MENSAJES.servidor, true);
      box.classList.remove('shake');
      void box.offsetWidth;
      box.classList.add('shake');
      bloquear(false);
    });
  }

  document.getElementById('lock-reset').addEventListener('click', function () {
    if (!ocupado) reiniciar();
  });
})();
