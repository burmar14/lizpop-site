/* Liz Pop Art: "A little walk", a quiet mini game for the Extras page.
   Walk a friend along the hill, gather flowers for a bouquet, hop the puddles, and hand it over.
   There is no score, no timer and no losing. Only this page loads this file.
   Sections: setup, art, world, drawing, game loop, start and end. */
(function () {
  'use strict';

  var cv = document.getElementById('walkCanvas');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel) { return document.querySelector(sel); }

  /* ---------- Setup ---------- */
  var NEED = 8;                     // flowers in a finished bouquet
  var W = 0, H = 0, U = 1, DPR = 1; // canvas size in css pixels, and one "design unit" (H / 360)
  var SPEED = 70;                   // how fast the hill scrolls, in design units per second
  var CHARS = [
    { id: 'pink', label: 'Pink', h: 104, lift: 0 },
    { id: 'orange', label: 'Orange', h: 84, lift: 0 },
    { id: 'blue', label: 'Blue', h: 74, lift: 14, flip: true }
  ];
  var FRIEND = { id: 'shadow', h: 132, lift: 0, flip: true };   // waits at the end of the hill, with an empty pot
  // the flowers she drew, whole: stem, leaves and all. They are shrunk down to fit the bouquet.
  var FLOWERS = [
    { img: 'tulip-red-1', h: 52, stem: '#357a7c' }, { img: 'tulip-yel-1', h: 32, stem: '#168a45' }, { img: 'tulip-red-2', h: 50, stem: '#357a7c' },
    { img: 'daisy', h: 34, stem: '#b9c5a2' }, { img: 'tulip-yel-2', h: 32, stem: '#168a45' }, { img: 'tulip-yel-3', h: 32, stem: '#168a45' }
  ];
  var LADYBUG_LINES = ['keep going', 'you are doing great', 'small steps count', 'take your time', 'I am glad you are here'];
  var quotes = [], shareArt = 0, ladyLines = LADYBUG_LINES.slice();

  var IMG = {};
  var NAMES = ['pink', 'orange', 'blue', 'shadow', 'tulip-red-1', 'tulip-red-2', 'tulip-yel-1', 'tulip-yel-2', 'tulip-yel-3',
    'daisy', 'strawberry', 'ladybug', 'sparkle'];

  /* ---------- Art ---------- */
  function loadArt() {
    return Promise.all(NAMES.map(function (n) {
      return new Promise(function (done) {
        var im = new Image();
        im.onload = im.onerror = done;
        im.src = '/images/game/' + n + '.webp';
        IMG[n] = im;
      });
    }));
  }
  // Draw a picture standing on (x, y) with its feet or stem base at the bottom centre.
  function pic(name, x, y, h, rot, sx, sy) {
    var im = IMG[name]; if (!im || !im.naturalWidth) return;
    var hh = h * U, ww = im.naturalWidth * hh / im.naturalHeight;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (sx) ctx.scale(sx, sy || sx);
    ctx.drawImage(im, -ww / 2, -hh, ww, hh); ctx.restore();
  }
  function picWidth(name, h) { var im = IMG[name]; return im && im.naturalWidth ? im.naturalWidth * h * U / im.naturalHeight : 40 * U; }

  /* ---------- World ---------- */
  var S = null;       // the current walk
  var chosen = CHARS[0], friendChar = FRIEND;
  var grass = [], clouds = [];

  function newWalk() {
    S = {
      mode: 'walk', t: 0, scroll: 0, step: 0,
      got: 0, treats: 0, boost: 0, flowers: [], bag: dealBag(),
      px: 0, py: 0, vy: 0, squash: 0, slow: 0, hopped: false,
      items: [], spawnIn: 0.8, sinceFlower: 0, ladyIn: 7, lady: null,
      drops: [], bits: [], gift: 0, friend: null, endIn: 0, shown: false
    };
    grass = []; for (var i = 0; i < 70; i++) grass.push({ x: Math.random() * 1400, y: Math.random(), l: 4 + Math.random() * 6 });
    clouds = []; for (var c = 0; c < 5; c++) clouds.push({ x: Math.random() * 1500, y: 20 + Math.random() * 90, s: 0.7 + Math.random() * 0.7 });
  }
  var groundY = function () { return H * 0.8; };
  var playerX = function () { return W * 0.24; };

  // Eight flowers per walk, dealt from a shuffled bag: every kind shows up, and no two of the same come in a row.
  function dealBag() {
    var by = {}; FLOWERS.forEach(function (f) { by[f.img] = f; });
    var base = ['tulip-red-1', 'tulip-red-2', 'tulip-yel-1', 'tulip-yel-2', 'tulip-yel-3', 'daisy', 'daisy'];
    var extra = ['daisy', 'tulip-red-1', 'tulip-yel-2'][Math.floor(Math.random() * 3)];
    var bag, tries = 0;
    do {
      bag = base.concat(extra).sort(function () { return Math.random() - 0.5; });
      var clash = bag.some(function (n, i) { return i && n === bag[i - 1]; });
      tries++;
    } while (clash && tries < 60);
    return bag.map(function (n) { return by[n]; });
  }
  function spawn() {
    var gap = 1.5 + Math.random() * 1.3, r = Math.random();
    S.sinceFlower++;
    var type = (S.sinceFlower >= 2 && r < 0.62) || S.sinceFlower >= 4 ? 'flower' : (r < 0.8 ? 'puddle' : 'treat');
    if (type === 'flower') S.sinceFlower = 0;
    var it = { type: type, x: W + 120 * U, got: false, hit: false, id: Math.random() * 6, flip: Math.random() < 0.5 };
    if (type === 'flower') { if (!S.bag.length) S.bag = dealBag(); var f = S.bag.shift(); it.img = f.img; it.h = f.h; it.stem = f.stem; }
    if (type === 'puddle') { it.w = 118 + Math.random() * 40; }
    if (type === 'treat') { it.img = 'strawberry'; it.h = 34; it.lift = 84 + Math.random() * 16; }
    S.items.push(it);
    S.spawnIn = gap;
  }

  /* ---------- Little effects ---------- */
  function sparkle(x, y, n) {
    for (var i = 0; i < (n || 4); i++) S.bits.push({ kind: 's', x: x + (Math.random() - .5) * 30 * U, y: y + (Math.random() - .5) * 20 * U, vy: -30 - Math.random() * 30, a: 1, r: 14 + Math.random() * 12 });
  }
  function splash(x, y) {
    for (var i = 0; i < 9; i++) S.drops.push({ x: x, y: y, vx: (Math.random() - .5) * 140, vy: -120 - Math.random() * 110, a: 1 });
  }
  var audio = null, soundOn = false;
  function chime(n) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var notes = [523, 587, 659, 784, 880], o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = 'sine'; o.frequency.value = notes[n % notes.length];
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.75);
    } catch (e) {}
  }
  function say(msg) { var el = $('#walkStatus'); if (el) el.textContent = msg; }

  /* ---------- Drawing ---------- */
  var INK = '#231d1a';
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  function drawSky(p) {
    var top = mix([169, 214, 245], [246, 182, 160], p), low = mix([254, 246, 220], [255, 224, 170], p);
    var g = ctx.createLinearGradient(0, 0, 0, groundY()); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(low));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawSun() {
    // a plain gold sun peeking in from the top right corner
    var sr = 84 * U;
    ctx.fillStyle = '#e0b43c'; ctx.strokeStyle = INK; ctx.lineWidth = 3 * U;
    ctx.beginPath(); ctx.arc(W + 8 * U, -8 * U, sr, 0, 7); ctx.fill(); ctx.stroke();
  }
  function drawClouds() {
    clouds.forEach(function (c) {
      var x = ((c.x - S.scroll * 0.06) % (W + 260 * U) + W + 260 * U) % (W + 260 * U) - 130 * U, y = c.y * U, s = c.s * U;
      var bumps = [[0, 0, 34], [30, -10, 28], [58, 2, 30], [24, 8, 30]];
      ctx.fillStyle = '#fffdf7'; ctx.strokeStyle = INK; ctx.lineWidth = 7 * U;
      bumps.forEach(function (b) { ctx.beginPath(); ctx.arc(x + b[0] * s, y + b[1] * s, b[2] * s * 0.7, 0, 7); ctx.stroke(); });
      bumps.forEach(function (b) { ctx.beginPath(); ctx.arc(x + b[0] * s, y + b[1] * s, b[2] * s * 0.7, 0, 7); ctx.fill(); });
    });
  }
  function hill(f, amp, base, fill, wave) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= W + 10; x += 10) ctx.lineTo(x, base - amp * U * (0.5 + 0.5 * Math.sin((x + S.scroll * f) / (wave * U))));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3 * U; ctx.stroke();
  }
  function drawGround() {
    var gy = groundY();
    ctx.fillStyle = '#8bc276'; ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5 * U; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    ctx.strokeStyle = '#5f9a4e'; ctx.lineWidth = 2 * U; ctx.lineCap = 'round';
    grass.forEach(function (g) {
      var x = ((g.x * U - S.scroll) % (W + 40) + W + 40) % (W + 40) - 20, y = gy + 12 * U + g.y * (H - gy - 22 * U);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 * U, y - g.l * U); ctx.stroke();
    });
  }
  function drawPuddle(x, w, wet) {
    var gy = groundY() + 14 * U, ww = w * U;
    ctx.fillStyle = '#74c2f4'; ctx.strokeStyle = INK; ctx.lineWidth = 3 * U;
    ctx.beginPath(); ctx.ellipse(x, gy, ww / 2, 11 * U, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d7efff'; ctx.lineWidth = 2 * U;
    ctx.beginPath(); ctx.ellipse(x - ww * 0.12, gy, ww * 0.18, 4 * U, 0, 0.1, 3.0); ctx.stroke();
    if (wet) { ctx.beginPath(); ctx.ellipse(x + ww * 0.12, gy, ww * 0.3, 7 * U, 0, 3.4, 6.1); ctx.stroke(); }
  }
  function drawTree(x) {
    var gy = groundY();
    ctx.fillStyle = '#b07a52'; ctx.strokeStyle = INK; ctx.lineWidth = 3 * U;
    ctx.beginPath(); ctx.rect(x - 9 * U, gy - 86 * U, 18 * U, 88 * U); ctx.fill(); ctx.stroke();
    [[0, -120, 52], [-34, -96, 38], [34, -98, 40]].forEach(function (b) { ctx.fillStyle = '#6fae5c'; ctx.beginPath(); ctx.arc(x + b[0] * U, gy + b[1] * U, b[2] * U, 0, 7); ctx.lineWidth = 3 * U; ctx.stroke(); });
    [[0, -120, 52], [-34, -96, 38], [34, -98, 40]].forEach(function (b) { ctx.fillStyle = '#6fae5c'; ctx.beginPath(); ctx.arc(x + b[0] * U, gy + b[1] * U, b[2] * U - 1.5 * U, 0, 7); ctx.fill(); });
  }
  function drawHeart(x, y, s, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a; ctx.fillStyle = '#f590c9'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-14, -4, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -4, 0, 6); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // The bouquet grows with every flower gathered: the whole flowers fan out from one point, small and tidy,
  // with paper and a bow at the bottom. `inPot` draws just the flowers (no paper) for the friend's pot.
  var SLOTS = [0, 1, -1, 2, -2, 3, -3, 4];
  function arrange(list) {
    var reds = list.filter(function (f) { return /red/.test(f.img); }), dais = list.filter(function (f) { return f.img === 'daisy'; }), yels = list.filter(function (f) { return /yel/.test(f.img); });
    var out = reds.slice(0, 1), rest = [], i = 0;
    while (dais.length || yels.length) { if (i % 2 === 0 && yels.length) rest.push(yels.shift()); else if (dais.length) rest.push(dais.shift()); else rest.push(yels.shift()); i++; }
    // the second red goes to the first outer spot, then the rest alternate outward
    return out.concat(reds.slice(1), rest);
  }
  function drawBouquet(bx, by, scale, inPot) {
    var n = S.flowers.length, k = 0.78 * scale, arranged = arrange(S.flowers);
    var order = []; for (var i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { return Math.abs(SLOTS[b]) - Math.abs(SLOTS[a]); });   // outer flowers first, middle on top
    order.forEach(function (i) {
      var f = arranged[i], a = SLOTS[i] * 0.17 * (inPot ? 0.85 : 1), len = (30 - 2.5 * Math.abs(SLOTS[i])) * U * scale;
      var ex = bx + Math.sin(a) * len, ey = by - Math.cos(a) * len;
      ctx.strokeStyle = f.stem || '#357a7c'; ctx.lineWidth = 3 * U * scale; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by - 2 * U); ctx.lineTo(ex, ey + 2 * U); ctx.stroke();
      pic(f.img, ex, ey, (34 + f.h * 0.8) * k * (1 - 0.035 * Math.abs(SLOTS[i])), a, ((i % 2 === 1) !== !!f.flip) ? -1 : 1, 1);   // neighbours alternate, with a little randomness
    });
    if (n && !inPot) {
      var w = 15 * U * scale;
      ctx.fillStyle = '#fffdf7'; ctx.strokeStyle = INK; ctx.lineWidth = 2 * U; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(bx - w, by - 13 * U * scale); ctx.lineTo(bx + w, by - 13 * U * scale); ctx.lineTo(bx + 3 * U * scale, by + 9 * U * scale); ctx.lineTo(bx - 3 * U * scale, by + 9 * U * scale); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f590c9';
      ctx.beginPath(); ctx.ellipse(bx - 6 * U * scale, by - 5 * U * scale, 6 * U * scale, 3.4 * U * scale, -0.35, 0, 7); ctx.ellipse(bx + 6 * U * scale, by - 5 * U * scale, 6 * U * scale, 3.4 * U * scale, 0.35, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by - 5 * U * scale, 2.4 * U * scale, 0, 7); ctx.fillStyle = '#ffd94a'; ctx.fill(); ctx.stroke();
    }
  }
  function drawHud() {
    var x = 64 * U, y = 128 * U;
    ctx.fillStyle = 'rgba(255,253,247,.8)'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5 * U;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(12 * U, 12 * U, 104 * U, 128 * U, 14 * U) : ctx.rect(12 * U, 12 * U, 104 * U, 128 * U); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = '600 ' + 13 * U + 'px "Comic Sans MS","Comic Neue",cursive'; ctx.textAlign = 'center';
    ctx.fillText(S.got + ' of ' + NEED, 64 * U, 32 * U); ctx.textAlign = 'left';
    if (S.mode !== 'gift' && S.mode !== 'done') drawBouquet(x, y, 1, false);
  }
  function drawBubble(x, y, text) {
    ctx.font = '700 ' + 14 * U + 'px "Comic Sans MS","Comic Neue",cursive';
    var tw = ctx.measureText(text).width, w = tw + 22 * U, h = 30 * U, bx = Math.min(Math.max(8 * U, x - w / 2), W - w - 8 * U), by = y - h - 16 * U;
    ctx.fillStyle = '#fffdf7'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5 * U;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, w, h, 14 * U) : ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6 * U, by + h - 1); ctx.lineTo(x, by + h + 12 * U); ctx.lineTo(x + 8 * U, by + h - 1); ctx.fillStyle = '#fffdf7'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText(text, bx + w / 2, by + h / 2 + 5 * U); ctx.textAlign = 'left';
  }

  function drawScene() {
    var p = Math.min(1, S.got / NEED);
    drawSky(p); drawClouds(); drawSun();
    hill(0.15, 70, groundY() - 10 * U, '#b9d9c0', 330);
    hill(0.35, 44, groundY() + 2 * U, '#9fcf8f', 210);
    drawGround();
    if (S.friend) drawTree(S.friend.x + 34 * U);
    S.items.forEach(function (it) {
      if (it.type === 'puddle') drawPuddle(it.x, it.w, it.hit);
      else if (!it.got) { var sway = it.type === 'treat' ? 0.05 : Math.sin(S.t * 1.4 + it.id) * 0.03; pic(it.img, it.x, groundY() - (it.lift || 0) * U, it.h, sway, it.flip ? -1 : 1, 1); }
    });
    var happy = (S.mode === 'gift' || S.mode === 'done') && S.gift >= 1, pot = null, fb = 0;
    if (S.friend) {
      fb = Math.max(0, Math.sin(S.t * 3.2)) * 7 * U * (happy ? 1.8 : 0.5);
      var fs = friendChar.h * U / 330, fy = groundY() - fb - friendChar.lift * U;
      pot = { x: S.friend.x - (110 - 92.5) * fs, y: fy + (94 - 330) * fs };   // his pot is on the side facing the walker
      if (happy) drawBouquet(pot.x, pot.y + 6 * U, 0.82, true);      // the flowers fill his pot, behind its front
      pic(friendChar.id, S.friend.x, fy, friendChar.h, happy ? Math.sin(S.t * 5) * 0.035 : Math.sin(S.t * 2) * 0.02, -1, 1);
    }
    // the walker: little bob, a squash when landing, and a lift for the floaty blue one
    var bob = S.mode === 'walk' && S.slow <= 0 ? Math.sin(S.t * 6) * 1.8 * U : 0, sq = S.squash > 0 ? 1 - 0.1 * S.squash : 1;
    pic(chosen.id, playerX(), groundY() + S.py - chosen.lift * U + bob - (chosen.lift ? Math.sin(S.t * 2.2) * 5 * U : 0), chosen.h, Math.sin(S.t * 3) * 0.035, (chosen.flip ? -1 : 1) / sq, sq);
    // gift on its way to the friend
    if (S.mode === 'gift' || S.mode === 'done') {
      var k = Math.min(1, S.gift), ease = k * k * (3 - 2 * k);
      if (k < 1) {
        var gx = 64 * U + (pot.x - 64 * U) * ease, gy = 128 * U + (pot.y - 128 * U) * ease - Math.sin(ease * Math.PI) * 70 * U;
        drawBouquet(gx, gy, 1 + 0.25 * Math.sin(ease * Math.PI) - 0.18 * ease, false);
        if (!reduceMotion && Math.random() < 0.55) sparkle(gx + (Math.random() - .5) * 20 * U, gy - 20 * U, 1);
      }
      else {
        for (var h = 0; h < 4; h++) drawHeart(S.friend.x + Math.sin(S.t * 1.8 + h * 1.7) * 34 * U, groundY() - (friendChar.h + 4 + ((S.t * 22 + h * 22) % 56)) * U, 1.3 * U, 0.9);
        drawBubble(S.friend.x, groundY() - fb - (friendChar.h + 14) * U, 'Aw thanks!');
      }
    }
    // ladybug and its message
    if (S.lady) {
      pic('ladybug', S.lady.x, S.lady.y, 38, Math.sin(S.t * 5) * 0.2);
      if (S.lady.say) drawBubble(S.lady.x, S.lady.y - 40 * U, S.lady.say);
    }
    S.drops.forEach(function (d) { ctx.globalAlpha = Math.max(0, d.a); ctx.fillStyle = '#74c2f4'; ctx.beginPath(); ctx.arc(d.x, d.y, 3 * U, 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
    S.bits.forEach(function (b) { ctx.globalAlpha = Math.max(0, b.a); var im = IMG.sparkle; if (im && im.naturalWidth) ctx.drawImage(im, b.x - b.r * U / 2, b.y - b.r * U / 2, b.r * U, b.r * U * im.naturalHeight / im.naturalWidth); ctx.globalAlpha = 1; });
    drawHud();
  }

  /* ---------- Game loop ---------- */
  var last = 0, raf = 0, running = false;
  function hop() {
    if (!S || S.mode === 'done' || S.py < -1) return;
    S.vy = -300 * U; S.hopped = true; chime(2);
  }
  function update(dt) {
    S.t += dt;
    var walking = S.mode === 'walk', ending = S.mode === 'end';
    var speed = (S.slow > 0 ? 0.55 : S.boost > 0 ? 1.6 : 1) * SPEED * U;
    // scrolling (a step at a time when motion is reduced)
    var move = 0;
    if (S.mode === 'walk' || S.mode === 'end') {
      if (reduceMotion) { var m = Math.min(S.step, 150 * U * dt); S.step -= m; move = m; }
      else move = speed * dt;
    }
    if (ending && S.friend) {
      var gap = S.friend.x - playerX() - 120 * U;
      if (gap <= 2 * U) { move = 0; S.mode = 'gift'; S.gift = 0; say('The flowers are in his pot.'); chime(4); chime(0); }
      else move = Math.min(move, gap);
    }
    S.scroll += move;
    S.items.forEach(function (it) { it.x -= move; });
    if (S.friend) S.friend.x -= move;
    S.items = S.items.filter(function (it) { return it.x > -160 * U; });
    // hopping
    S.vy += 760 * U * dt; S.py += S.vy * dt;
    if (S.py >= 0) { if (S.vy > 60 * U) S.squash = 1; S.py = 0; S.vy = 0; S.hopped = false; }
    S.squash = Math.max(0, S.squash - dt * 6); S.slow = Math.max(0, S.slow - dt); S.boost = Math.max(0, S.boost - dt);
    // spawning
    if (walking) {
      S.spawnIn -= (reduceMotion ? move / (SPEED * U) : dt);
      if (S.spawnIn <= 0) spawn();
      S.ladyIn -= dt;
      if (S.ladyIn <= 0 && !S.lady) { S.lady = { x: W + 30 * U, y: H * (0.27 + Math.random() * 0.1), say: '', t: 0 }; S.ladyIn = 16 + Math.random() * 8; }
    }
    if (walking && S.got >= NEED) { S.mode = 'end'; S.friend = { x: W + 300 * U }; }
    // picking things up
    var px = playerX();
    S.items.forEach(function (it) {
      var near = Math.abs(it.x - px) < (it.type === 'puddle' ? it.w * U * 0.42 : 34 * U);
      if (it.type === 'flower' && !it.got && near && S.mode === 'walk') {
        it.got = true; S.got++; S.flowers.push({ img: it.img, h: it.h, stem: it.stem, flip: it.flip }); sparkle(it.x, groundY() - it.h * U * 0.7, 5); chime(S.got);
        say(S.got + ' of ' + NEED + ' flowers.');
      } else if (it.type === 'treat' && !it.got && near && Math.abs((groundY() - it.lift * U) - (groundY() + S.py - 40 * U)) < 54 * U) {
        it.got = true; S.treats++; S.boost = 2.2; S.slow = 0; sparkle(it.x, groundY() - it.lift * U, 6); chime(1); say('A strawberry.');
      } else if (it.type === 'puddle' && near && !it.hit) {
        it.hit = true;
        if (S.py > -16 * U) { S.slow = 0.9; splash(it.x, groundY() + 8 * U); }
        else { sparkle(it.x, groundY() - 30 * U, 3); }
      }
    });
    // the ladybug flies by and says something kind when it passes the walker
    if (S.lady) {
      S.lady.x -= (reduceMotion ? 30 : 46) * U * dt; S.lady.t += dt; S.lady.y += Math.sin(S.lady.t * 2) * 0.25 * U;
      if (!S.lady.said && S.lady.x < px + 160 * U) { S.lady.say = ladyLines[Math.floor(Math.random() * ladyLines.length)]; S.lady.said = true; say('The ladybug says: ' + S.lady.say); }
      if (S.lady.said && S.lady.x < px + 10 * U) S.lady.y -= 70 * U * dt;      // after saying it, up and away
      if (S.lady && (S.lady.y < -30 * U || S.lady.x < -40 * U)) S.lady = null;
    }
    // the hand-over
    if (S.mode === 'gift') {
      S.gift += dt * 0.5;
      if (S.gift >= 3 && !S.shown) { S.shown = true; S.mode = 'done'; showEnd(); }
    }
    // little effects
    S.drops.forEach(function (d) { d.x += d.vx * dt * U / 1; d.y += d.vy * dt * U; d.vy += 520 * dt; d.a -= dt * 1.4; });
    S.drops = S.drops.filter(function (d) { return d.a > 0; });
    S.bits.forEach(function (b) { b.y += b.vy * dt * U; b.a -= dt * 1.1; });
    S.bits = S.bits.filter(function (b) { return b.a > 0; });
  }
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    try { update(dt); drawScene(); } catch (e) { if (window.console) console.warn('walk:', e); }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (S && S.mode !== 'done' && !$('#walkPick').classList.contains('is-open')) start(); });

  function resize() {
    var r = cv.getBoundingClientRect(); DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(280, r.width); H = Math.max(260, r.height); U = H / 360;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (S && !running) drawScene();
  }
  window.addEventListener('resize', resize);

  /* ---------- Start and end ---------- */
  function showEnd() {
    var text = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : 'I am so glad you are here.';
    $('#walkQuote').textContent = text;
    var panel = $('#walkEnd'); panel.hidden = false;
    if (window.lizpopSetShare && quotes.length) window.lizpopSetShare(quotes, Math.max(0, quotes.indexOf(text)), shareArt);
    say(text);
    $('#walkAgain').focus({ preventScroll: true });
    stop(); drawScene();
  }
  function begin() {
    $('#walkPick').classList.remove('is-open'); $('#walkPick').hidden = true; $('#walkEnd').hidden = true;
    newWalk(); resize(); say('Walking.'); start(); cv.focus({ preventScroll: true });
  }
  function openPick() {
    stop(); $('#walkEnd').hidden = true; var p = $('#walkPick'); p.hidden = false; p.classList.add('is-open');
    newWalk(); resize(); drawScene();
  }

  function buildPicker() {
    var box = $('#walkChars');
    var saved = ''; try { saved = localStorage.getItem('lp-walker') || ''; } catch (e) {}
    chosen = CHARS.filter(function (c) { return c.id === saved; })[0] || CHARS[0];
    box.innerHTML = CHARS.map(function (c) {
      return '<button type="button" class="walk-char" data-id="' + c.id + '" aria-pressed="' + (c.id === chosen.id) + '">' +
        '<img src="/images/game/' + c.id + '.webp" alt="" width="70" height="90"><span>' + c.label + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        chosen = CHARS.filter(function (c) { return c.id === b.getAttribute('data-id'); })[0];
        Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        try { localStorage.setItem('lp-walker', chosen.id); } catch (e) {}
      });
    });
  }

  function onAction(e) {
    if (!S || !running) return;
    if (e) e.preventDefault();
    if (reduceMotion) { S.step = Math.min(S.step + 150 * U, 450 * U); }
    hop();
  }
  cv.addEventListener('pointerdown', onAction);
  $('#walkHop').addEventListener('click', function () { onAction(); });
  document.addEventListener('keydown', function (e) {
    if (!running) return;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      if (document.activeElement && /^(BUTTON|A|INPUT|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.id !== 'walkCanvas') return;
      onAction(e);
    }
  });
  $('#walkStart').addEventListener('click', begin);
  $('#walkAgain').addEventListener('click', function () { $('#walkEnd').hidden = true; openPick(); $('#walkStart').focus({ preventScroll: true }); });
  var soundBtn = $('#walkSound');
  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn; soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off'; if (soundOn) chime(0);
  });

  // content: the reminders (also shown when the walk ends) and the ladybug's lines can be edited in the admin
  Promise.all([
    fetch('/content/quotes.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return null; }),
    fetch('/content/site.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).catch(function () { return null; })
  ]).then(function (res) {
    var q = res[0], site = res[1];
    if (q) quotes = (q.items || []).filter(function (i) { return i.show !== false && i.text; }).map(function (i) { return i.text; });
    var lines = site && site.extras && site.extras.walk && site.extras.walk.ladybug_lines;
    if (lines && lines.length) ladyLines = lines;
    shareArt = site && site.share && site.share.art ? Math.floor(Math.random() * site.share.art.length) : 0;
  });

  // For testing only: with ?walktest in the address, the game can be stepped by hand.
  if (/[?&]walktest/.test(location.search)) window.__walk = {
    tick: function (dt) { if (S) { update(dt); drawScene(); } },
    hop: hop, freeze: stop, state: function () { return S; }
  };

  buildPicker();
  loadArt().then(function () { openPick(); $('#walkStart').disabled = false; });
})();
