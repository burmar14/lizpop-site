/* Liz Pop Art: loads content/*.json (edited through /admin) and renders the page.
   Sections: helpers, content loading, viewer, hero, reminder and sharing, prints, portfolio,
   book and events, most loved and studio, newsletter, footer, boot. */
(function () {
  'use strict';

  var page = document.body.getAttribute('data-page');

  /* ---------- Helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Open links to other sites in a new tab, safely.
  function externalize(root) {
    $all('a[href^="http"]', root).forEach(function (a) {
      if (a.hostname !== location.hostname) { a.target = '_blank'; a.rel = 'noopener'; }
    });
  }

  /* ---------- Content loading ---------- */

  function load(name) {
    return fetch('/content/' + name + '.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(name); return r.json(); });
  }

  // Simple bindings: data-text="book.title", data-href="book.amazon_url", data-src="book.cover".
  // Elements marked data-hide-empty disappear when their value is blank.
  function bind(site) {
    $all('[data-text]').forEach(function (el) {
      var v = get(site, el.getAttribute('data-text'));
      if (v) el.textContent = v; else if (el.hasAttribute('data-hide-empty')) el.hidden = true;
    });
    $all('[data-href]').forEach(function (el) {
      var key = el.getAttribute('data-href'), v = get(site, key);
      if (v) el.href = (el.getAttribute('data-prefix') || '') + v;
      else if (el.hasAttribute('data-hide-empty')) el.hidden = true;
    });
    $all('[data-src]').forEach(function (el) {
      var v = get(site, el.getAttribute('data-src'));
      if (v) el.src = v; else if (el.hasAttribute('data-hide-empty')) el.hidden = true;
    });
    $all('[data-paras]').forEach(function (el) {
      var v = get(site, el.getAttribute('data-paras'));
      if (v) el.innerHTML = String(v).split(/\n\s*\n/).map(function (p) { return '<p>' + esc(p.trim()) + '</p>'; }).join('');
    });
    $all('[data-list]').forEach(function (el) {
      var v = get(site, el.getAttribute('data-list'));
      if (Array.isArray(v) && v.length) el.innerHTML = v.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    });
    $all('[data-stats]').forEach(function (el) {
      var v = get(site, el.getAttribute('data-stats'));
      if (Array.isArray(v) && v.length) el.innerHTML = v.map(function (s) {
        return '<div class="stat"><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>';
      }).join('');
    });
  }

  /* ---------- Viewer (images and videos) ---------- */
  var viewer = $('#viewer'), viewerBody = viewer && $('.viewer-body', viewer), gallery = [], galleryIndex = 0;

  function closeViewer() { if (viewer && viewer.open) viewer.close(); }
  if (viewer) {
    viewer.addEventListener('close', function () { viewerBody.innerHTML = ''; });
    viewer.addEventListener('click', function (e) { if (e.target === viewer) closeViewer(); });
    $('.close', viewer).addEventListener('click', closeViewer);
    document.addEventListener('keydown', function (e) {
      if (!viewer.open || gallery.length < 2) return;
      if (e.key === 'ArrowRight') showImage(galleryIndex + 1);
      if (e.key === 'ArrowLeft') showImage(galleryIndex - 1);
    });
  }
  function showImage(i) {
    galleryIndex = (i + gallery.length) % gallery.length;
    var g = gallery[galleryIndex];
    viewerBody.innerHTML = '<img src="' + esc(g.src) + '" alt="' + esc(g.alt) + '">' +
      (gallery.length > 1 ? '<p class="sr-only">Image ' + (galleryIndex + 1) + ' of ' + gallery.length + '. Use arrow keys for more.</p>' : '');
    viewerBody.firstChild.addEventListener('click', function () { if (gallery.length > 1) showImage(galleryIndex + 1); });
  }
  function openImages(list, start) {
    if (!viewer) return;
    gallery = list; showImage(start || 0); viewer.showModal();
  }

  // Turn a video link into an embeddable player. Instagram and TikTok open on their own sites,
  // which keeps the page fast and avoids their tracking scripts.
  function embedFor(url) {
    var m;
    if ((m = url.match(/youtube\.com\/shorts\/([\w-]{6,})/))) return { src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0', vertical: true };
    if ((m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/))) return { src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0' };
    if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { src: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1&dnt=1' };
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { file: url };
    return null;
  }
  function openVideo(url, vertical, title) {
    var e = embedFor(url);
    if (!e || !viewer) { window.open(url, '_blank', 'noopener'); return; }
    var v = e.vertical || vertical;
    viewerBody.innerHTML = '<div class="frame-wrap' + (v ? ' vertical' : '') + '">' +
      (e.file
        ? '<video src="' + esc(e.file) + '" controls autoplay playsinline></video>'
        : '<iframe src="' + esc(e.src) + '" title="' + esc(title || 'Video') + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>') +
      '</div>';
    viewer.showModal();
  }

  /* ---------- Hero slideshow ---------- */
  // The small line and the headline change from visit to visit, and never repeat the last one you saw.
  function pickFresh(list, key) {
    var last = '';
    try { last = localStorage.getItem(key) || ''; } catch (e) {}
    var pool = list.filter(function (x) { return JSON.stringify(x) !== last; });
    var choice = (pool.length ? pool : list)[Math.floor(Math.random() * (pool.length || list.length))];
    try { localStorage.setItem(key, JSON.stringify(choice)); } catch (e) {}
    return choice;
  }
  function rotateHeroWords(hero) {
    if (!hero || !$('[data-text="hero.kicker"]')) return;
    var kickers = [hero.kicker].concat(hero.kickers || []).filter(Boolean);
    var headlines = [{ headline: hero.headline, highlight: hero.highlight }]
      .concat(hero.headlines || []).filter(function (h) { return h.headline && h.highlight; });
    if (kickers.length > 1) $('[data-text="hero.kicker"]').textContent = pickFresh(kickers, 'lp-kicker');
    if (headlines.length > 1) {
      var h = pickFresh(headlines, 'lp-headline');
      $('[data-text="hero.headline"]').textContent = h.headline;
      $('[data-text="hero.highlight"]').textContent = h.highlight;
    }
  }
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function renderHero(hero) {
    var scene = $('#heroScene'), dots = $('#heroDots');
    var slides = ((hero && hero.slides) || []).filter(function (s) { return s.image; });
    if (!scene || !slides.length) return;
    // Shuffle the whole lineup every visit, and never open on the same piece as last time.
    var first = 0;
    if (slides.length > 1) {
      var last = '';
      try { last = localStorage.getItem('lp-hero') || ''; } catch (e) {}
      for (var k = slides.length - 1; k > 0; k--) {
        var j = Math.floor(Math.random() * (k + 1)), t = slides[k]; slides[k] = slides[j]; slides[j] = t;
      }
      if (slides[0].image === last) { var t2 = slides[0]; slides[0] = slides[1]; slides[1] = t2; }
      try { localStorage.setItem('lp-hero', slides[0].image); } catch (e) {}
    }
    scene.innerHTML = slides.map(function (s, i) {
      return '<img class="slide' + (i === first ? ' is-on' : '') + '" src="' + esc(s.image) + '" alt="' + esc(s.alt || '') + '"' +
        (i === first ? ' fetchpriority="high"' : ' loading="lazy" aria-hidden="true"') + ' width="864" height="1080">';
    }).join('');
    var imgs = $all('img', scene), cur = first, timer;
    if (slides.length < 2) return;
    // Dots only make sense for a handful of slides; a long lineup just fades along on its own.
    if (slides.length <= 8) {
      dots.innerHTML = slides.map(function (s, i) {
        return '<button type="button" aria-label="Show artwork ' + (i + 1) + '"' + (i === first ? ' aria-current="true"' : '') + '></button>';
      }).join('');
    }
    var btns = $all('button', dots);
    function show(i) {
      imgs[cur].classList.remove('is-on'); imgs[cur].setAttribute('aria-hidden', 'true'); if (btns[cur]) btns[cur].removeAttribute('aria-current');
      cur = (i + imgs.length) % imgs.length;
      imgs[cur].classList.add('is-on'); imgs[cur].removeAttribute('aria-hidden'); if (btns[cur]) btns[cur].setAttribute('aria-current', 'true');
    }
    function start() { if (!reduceMotion) { clearInterval(timer); timer = setInterval(function () { show(cur + 1); }, 5500); } }
    btns.forEach(function (b, i) { b.addEventListener('click', function () { show(i); start(); }); });
    scene.addEventListener('mouseenter', function () { clearInterval(timer); });
    scene.addEventListener('mouseleave', start);
    start();
  }

  /* ---------- Reminder and sharing ---------- */
  // Everyone sees the same quote on a given day; it changes at local midnight.
  // Everyone sees the same quote on a given day; it changes at local midnight.
  function renderQuotes(data, pool) {
    var box = $('#qotd'), btn = $('#qnext'), pic = $('#qArt');
    if (!box) return;
    var list = (data.items || []).filter(function (q) { return q.show !== false && q.text; }).map(function (q) { return q.text; });
    if (!list.length) { box.closest('section').hidden = true; return; }
    var d = new Date();
    var day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    var i = day % list.length;
    quoteState.list = list; quoteState.i = i;
    box.textContent = list[i];
    // The Extras page card also shows a doodle, which changes along with the reminder.
    var arts = pool || [], artIndex = null;
    function swapArt() {
      if (!pic) return;
      if (!arts.length) { pic.hidden = true; return; }
      var n = artIndex;
      while (arts.length > 1 && (n === artIndex || arts[n].image === last)) n = Math.floor(Math.random() * arts.length);
      artIndex = n; last = '';
      pic.src = arts[n].image; pic.alt = arts[n].label || '';
    }
    // On a fresh visit, start on a different doodle than last time.
    var last = '';
    try { last = localStorage.getItem('lp-card-art') || ''; } catch (e) {}
    swapArt();
    try { if (pic && arts.length) localStorage.setItem('lp-card-art', arts[artIndex].image); } catch (e) {}
    var send = $('#qshare');
    if (send) send.addEventListener('click', function () { quoteState.i = i; quoteState.art = artIndex === null ? null : arts[artIndex].share; });
    if (!btn) return;
    if (list.length < 2) { btn.hidden = true; return; }
    btn.addEventListener('click', function () {
      var next = i;
      while (next === i) next = Math.floor(Math.random() * list.length);
      i = next; quoteState.i = i;
      box.classList.add('fade');
      setTimeout(function () { box.textContent = list[i]; box.classList.remove('fade'); swapArt(); }, 250);
    });
  }

  // The "how are you feeling" builder on the Extras page: pick a feeling, get a matching reminder and doodle.
  function renderMoodBuilder(data, pool) {
    var chips = $('#moodChips'), result = $('#moodResult');
    if (!chips || !result) return;
    var items = (data.items || []).filter(function (q) { return q.show !== false && q.text; });
    var list = items.map(function (q) { return q.text; });
    var moods = (data.moods || []).filter(function (m) { return items.some(function (q) { return (q.moods || []).indexOf(m) > -1; }); });
    if (!moods.length) { $('#mood').hidden = true; return; }
    quoteState.list = quoteState.list.length ? quoteState.list : list;
    var arts = pool || [];
    var quote = $('#moodQuote'), pic = $('#moodArt'), pool = [], cur = -1, artIndex = null;
    function pick() {
      var choices = pool.filter(function (n) { return n !== cur; });
      return choices.length ? choices[Math.floor(Math.random() * choices.length)] : cur;
    }
    function show(n) {
      cur = n;
      quote.classList.add('fade');
      setTimeout(function () { quote.textContent = list[n]; quote.classList.remove('fade'); }, result.hidden ? 0 : 250);
      if (arts.length) {
        artIndex = Math.floor(Math.random() * arts.length);
        pic.src = arts[artIndex].image; pic.alt = arts[artIndex].label || '';
      } else pic.hidden = true;
      result.hidden = false;
    }
    chips.hidden = false;
    chips.innerHTML = '<span class="label">I\'m feeling</span>' +
      moods.map(function (m) { return '<button type="button" class="chip" aria-pressed="false" data-m="' + esc(m) + '">' + esc(m) + '</button>'; }).join('');
    $all('button', chips).forEach(function (b) {
      b.addEventListener('click', function () {
        $all('button', chips).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        var m = b.getAttribute('data-m');
        pool = list.map(function (t, n) { return n; }).filter(function (n) { return (items[n].moods || []).indexOf(m) > -1; });
        show(pick());
      });
    });
    $('#moodNext').addEventListener('click', function () { show(pick()); });
    $('#moodShare').addEventListener('click', function () { quoteState.i = cur; quoteState.art = artIndex === null ? null : arts[artIndex].share; });
  }

  function hash(str) { var x = 5381; for (var i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0; return (x >>> 0).toString(36); }
  var quoteState = { list: [], i: 0, art: null };
  function setupShare(share) {
    var dlg = $('#shareDialog'), btns = $all('#qshare, #moodShare');
    if (!dlg || !btns.length) return;
    var art = ((share && share.art) || []).filter(function (a) { return a.image; });
    if (!art.length) { btns.forEach(function (b) { b.hidden = true; }); return; }
    var sel = $('#shareArt'), pic = $('#sharePic'), from = $('#shareFrom'), status = $('#shareStatus');
    sel.innerHTML = art.map(function (a, i) { return '<option value="' + i + '">' + esc(a.label || ('Doodle ' + (i + 1))) + '</option>'; }).join('');
    function quote() { return quoteState.list[quoteState.i] || ''; }
    function link() {
      // Short preview page so texts show this reminder and doodle as the link preview.
      var u = location.origin + '/r/' + hash(quote()) + '-' + sel.value + '/';
      var f = from.value.trim(); if (f) u += '?from=' + encodeURIComponent(f);
      return u;
    }
    function message() {
      var f = from.value.trim();
      return (f ? f + ' sent you a little reminder' : 'Someone sent you a little reminder') + '. See it here: ' + link();
    }
    function refresh() {
      pic.src = art[+sel.value].image; pic.alt = art[+sel.value].label || '';
      $('#shareQuote').textContent = quote();
      $('#shareText').href = 'sms:?&body=' + encodeURIComponent(message());
      $('#shareEmail').href = 'mailto:?subject=' + encodeURIComponent('A little reminder for you') + '&body=' + encodeURIComponent(message());
      status.textContent = '';
    }
    sel.addEventListener('change', refresh); from.addEventListener('input', refresh);
    $('#shareCopy').addEventListener('click', function () {
      var text = link();
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
        status.textContent = 'Link copied. Paste it anywhere!';
      }).catch(function () { status.textContent = text; });
    });
    if (navigator.share) {
      var nat = $('#shareNative'); nat.hidden = false;
      nat.addEventListener('click', function () {
        navigator.share({ title: 'A little reminder for you', text: 'A little reminder for you. See it here:', url: link() }).catch(function () {});
      });
    }
    function open() { if (quoteState.art !== null && art[quoteState.art]) sel.value = quoteState.art; refresh(); dlg.showModal(); }
    btns.forEach(function (b) { b.addEventListener('click', open); });
    window.__openShare = open;
  }
  function checkGift(share) {
    var q = new URLSearchParams(location.search);
    if (!q.get('r')) return;
    var dlg = $('#giftDialog'); if (!dlg) return;
    var art = ((share && share.art) || []).filter(function (a) { return a.image; });
    var idx = quoteState.list.map(hash).indexOf(q.get('r'));
    var text = idx > -1 ? quoteState.list[idx] : quoteState.list[quoteState.i];
    if (idx > -1) { quoteState.i = idx; $('#qotd').textContent = text; }
    var a = art[+q.get('a')] || art[0];
    if (a) { $('#giftPic').src = a.image; $('#giftPic').alt = a.label || ''; } else { $('#giftPic').hidden = true; }
    var from = (q.get('from') || '').slice(0, 40);
    $('#giftFrom').textContent = from ? from + ' sent you a little reminder' : 'Someone sent you a little reminder';
    $('#giftQuote').textContent = text;
    $('#giftBack').addEventListener('click', function () { dlg.close(); if (window.__openShare) window.__openShare(); });
    history.replaceState(null, '', location.pathname + location.hash);
    dlg.showModal();
  }
  $all('dialog.sheet').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d || e.target.hasAttribute('data-close')) d.close(); });
  });

  /* ---------- Little extras: moon, season, breathing ---------- */
  // Every picture Liz has on the site that can stand on its own as a doodle: the shareable ones plus the hero lineup.
  function doodlePool(site) {
    var seen = {}, pool = [];
    ((site.share && site.share.art) || []).filter(function (a) { return a.image; }).forEach(function (a, i) {
      if (!seen[a.image]) { seen[a.image] = 1; pool.push({ image: a.image, label: a.label, share: i }); }
    });
    ((site.hero && site.hero.slides) || []).forEach(function (sl) {
      if (sl.image && !seen[sl.image]) { seen[sl.image] = 1; pool.push({ image: sl.image, label: sl.alt, share: null }); }
    });
    return pool;
  }
  var SYNODIC = 29.530588853;
  // A simple moon drawing: dark disc, lit part on top. f runs 0 (new) to 1 and back to new.
  function moonSVG(age) {
    var f = age / SYNODIC, k = Math.cos(2 * Math.PI * f), waxing = f < 0.5, rx = Math.abs(k) * 40;
    var limb = waxing ? 1 : 0, term = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="#231d1a"/>' +
      '<path d="M50 10 A40 40 0 0 ' + limb + ' 50 90 A' + rx.toFixed(1) + ' 40 0 0 ' + term + ' 50 10Z" fill="#ffd94a"/>' +
      '<circle cx="50" cy="50" r="40" fill="none" stroke="#231d1a" stroke-width="4"/></svg>';
  }
  var SEASON_ART = [
    '<img src="/images/doodle-sparkle.png?v=2" alt="">',
    '<img src="/images/cast/daisy.png" alt="">',
    '<img src="/images/doodle-strawberry.png" alt="">',
    '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M12 1 C 4 8, 2 18, 12 28 C 22 18, 20 8, 12 1 Z" fill="#c8642b" stroke="#231d1a" stroke-width="1.2"/><path d="M12 4 L12 27" stroke="#231d1a" stroke-width="1"/></svg>'
  ];
  function renderNature(ex) {
    var moonBox = $('#moonCard'), seasonBox = $('#seasonCard');
    if (!moonBox || !ex) return;
    var age = (((Date.now() / 86400000 - Date.UTC(2000, 0, 6, 18, 14) / 86400000) % SYNODIC) + SYNODIC) % SYNODIC;
    var moon = (ex.moon || [])[Math.floor(age / SYNODIC * 8 + 0.5) % 8];
    var thumb = '<img class="doodle-thumb" data-doodle src="/images/art/trust-grass.webp" alt="">';
    if (moon) moonBox.innerHTML = moonSVG(age) + '<div><div class="what">Tonight</div><h3>' + esc(moon.name) + '</h3><p>' + esc(moon.line) + '</p></div>' + thumb;
    else moonBox.hidden = true;
    var m = new Date().getMonth(), si = (m === 11 || m < 2) ? 0 : m < 5 ? 1 : m < 8 ? 2 : 3;
    var season = (ex.seasons || [])[si];
    if (season) seasonBox.innerHTML = SEASON_ART[si] + '<div><div class="what">This season</div><h3>' + esc(season.name) + '</h3><p>' + esc(season.line) + '</p></div>' + thumb;
    else seasonBox.hidden = true;
  }

  // Pair a doodle with each little extra: every [data-doodle] picture gets a different one.
  function placeDoodles(art) {
    var spots = $all('[data-doodle]');
    if (!spots.length) return;
    if (!art.length) { spots.forEach(function (el) { el.hidden = true; }); return; }
    var order = art.slice().sort(function () { return Math.random() - 0.5; });
    spots.forEach(function (el, n) {
      var a = order[n % order.length];
      el.src = a.image; el.alt = a.label || '';
    });
  }

  // One minute of breathing: in for four, out for four.
  function setupPause(art) {
    var ring = $('#breather');
    if (!ring) return;
    if (art.length) { var a = art[Math.floor(Math.random() * art.length)]; $('#pauseArt').src = a.image; $('#pauseArt').alt = a.label || ''; }
    var text = $('#breathText'), start = $('#pauseStart'), done = $('#pauseDone'), timer;
    function finish() {
      clearInterval(timer);
      ring.classList.remove('is-breathing');
      text.textContent = 'All done';
      done.hidden = false;
    }
    function run() {
      clearInterval(timer);
      start.hidden = true; done.hidden = true;
      ring.classList.add('is-breathing');
      text.textContent = 'Breathe in';
      var beat = 0;
      timer = setInterval(function () {
        beat++;
        if (beat >= 15) { finish(); return; }
        text.textContent = beat % 2 ? 'Breathe out' : 'Breathe in';
      }, 4000);
    }
    start.addEventListener('click', run);
    $('#pauseAgain').addEventListener('click', run);
  }

  /* ---------- Prints ---------- */
  function renderPrints(data, etsyUrl, max, moods, moodsLabel) {
    var grid = $('#printGrid');
    if (!grid) return;
    var shown = (data.items || []).filter(function (p) { return p.show !== false && p.image; });
    if (!shown.length) return;
    var bar = $('#moods');
    var usable = (moods || []).filter(function (m) { return shown.some(function (p) { return (p.moods || []).indexOf(m) > -1; }); });
    if (bar && usable.length) {
      bar.hidden = false;
      bar.innerHTML = '<span class="label">' + esc(moodsLabel || 'Shop by feeling') + '</span>' +
        '<button type="button" class="chip" aria-pressed="true" data-m="">All</button>' +
        usable.map(function (m) { return '<button type="button" class="chip" aria-pressed="false" data-m="' + esc(m) + '">' + esc(m) + '</button>'; }).join('');
      $all('button', bar).forEach(function (b) {
        b.addEventListener('click', function () {
          $all('button', bar).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          draw(b.getAttribute('data-m'));
        });
      });
    }
    function draw(mood) {
      var items = (mood ? shown.filter(function (p) { return (p.moods || []).indexOf(mood) > -1; }) : shown).slice(0, max || 12);
      grid.innerHTML = items.map(printHTML).join('');
      externalize(grid);
    }
    function printHTML(p) {
      return '<a class="print-card" href="' + esc(p.etsy_url || etsyUrl) + '">' +
        '<div class="tape"></div><div class="frame">' +
        '<div class="img-box"><img src="' + esc(p.image) + '" alt="' + esc(p.alt || p.title) + '" loading="lazy" decoding="async" width="400" height="500"></div>' +
        '<div class="title">' + esc(p.title) + '</div><div class="cue">See on Etsy</div></div></a>';
    }
    var want = new URLSearchParams(location.search).get('feeling');
    var pre = want && bar && $all('button', bar).filter(function (b) { return b.getAttribute('data-m') === want; })[0];
    if (pre) pre.click(); else draw('');
  }

  /* ---------- Portfolio and brand work ---------- */
  // Which brand topic is picked (empty = everything), and how to redraw the work grid when it changes.
  var workTopic = '', redrawWork = null, resetTopic = null;
  function setTopic(name) {
    workTopic = name;
    var note = $('#topicNote'), filters = $('#filters'), grid = $('#portfolioGrid');
    if (note) {
      note.hidden = !name;
      if (name) {
        note.innerHTML = 'Showing work for <b>' + esc(name) + '</b>. <button type="button" class="send-link" id="topicClear">Show everything</button>';
        $('#topicClear').addEventListener('click', function () { if (resetTopic) resetTopic(); });
      }
    }
    if (redrawWork) redrawWork();
    if (name) {
      var target = filters && !filters.hidden ? filters : (note || grid);
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 100, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  // The yellow highlight steps along the topic chips, one at a time. Tap one to jump down to the matching
  // work; tap it again (or "Show everything") to go back to stepping. Reduced motion keeps it still.
  function rotateChips() {
    $all('.chips').forEach(function (ul) {
      var items = $all('li', ul), n = 0, timer, picked = -1;
      if (items.length < 2) return;
      ul.classList.add('is-rotating');
      function light(i) {
        items[n].classList.remove('is-lit'); items[n].firstChild.setAttribute('aria-pressed', 'false');
        n = i;
        items[n].classList.add('is-lit'); items[n].firstChild.setAttribute('aria-pressed', 'true');
      }
      function startStepping() {
        clearInterval(timer);
        if (!reduceMotion) timer = setInterval(function () { light((n + 1) % items.length); }, 1600);
      }
      function release() { picked = -1; setTopic(''); startStepping(); }
      items.forEach(function (li, i) {
        li.innerHTML = '<button type="button" aria-pressed="false">' + li.innerHTML + '</button>';
        li.firstChild.addEventListener('click', function () {
          if (picked === i) { release(); return; }
          picked = i; clearInterval(timer);
          light(i);
          setTopic(li.textContent.trim());
        });
      });
      resetTopic = release;
      light(0);
      startStepping();
    });
  }

  var TYPE_LABEL = { influencer: 'Influencer video', animation: 'Animation', illustration: 'Illustration', video: 'Video', artwork: 'Illustration' };
  function isVideoItem(it) { return !!it.video_url && it.type !== 'illustration' && it.type !== 'artwork'; }
  function cardHTML(item, i) {
    var isVideo = isVideoItem(item);
    return '<article class="work-card" data-type="' + esc(item.type) + '">' +
      '<button type="button" class="thumb' + (item._w && item._w / item._h > 0.66 ? ' fits' : '') + '" data-i="' + i + '" aria-label="' + (isVideo ? 'Watch video: ' : 'View artwork: ') + esc(item.title) + '">' +
      (TYPE_LABEL[item.type] ? '<span class="badge t-' + esc(item.type) + '">' + TYPE_LABEL[item.type] + '</span>' : '') +
      (item.thumbnail
        ? '<img src="' + esc(item.thumbnail) + '" alt="' + esc(item.alt || item.title) + '" loading="lazy" decoding="async" width="' + (item._w || 400) + '" height="' + (item._h || 500) + '">'
        : '<span class="nameplate" aria-hidden="true">' + esc(item.client || item.title) + '</span>') +
      (isVideo ? '<span class="play" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M7 4 L20 12 L7 20 Z" fill="#231d1a"/></svg></span>' : '') +
      '</button><div class="body">' +
      (item.client ? '<div class="client">' + esc(item.client) + '</div>' : '') +
      '<h3>' + esc(item.title) + '</h3>' +
      (item.description ? '<p>' + esc(item.description) + '</p>' : '') +
      ((item.link_url || (isVideo && /instagram|tiktok/.test(item.video_url))) ? '<p><a href="' + esc(item.link_url || item.video_url) + '">' + (isVideo ? 'Watch the full video' : 'See the original post') + '</a></p>' : '') +
      '</div></article>';
  }

  function wireCards(root, items) {
    $all('.thumb', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var it = items[+b.getAttribute('data-i')];
        if (isVideoItem(it)) { openVideo(it.video_url, it.orientation !== 'horizontal', it.title); return; }
        if (!it.thumbnail) { if (it.link_url) window.open(it.link_url, '_blank', 'noopener'); return; }
        var imgs = [{ src: it.thumbnail, alt: it.alt || it.title }].concat((it.gallery || []).map(function (g) { return { src: g.image, alt: g.alt || it.title }; }));
        openImages(imgs, 0);
      });
    });
    externalize(root);
  }

  // Find each thumbnail's real shape first, so the masonry lays out once and nothing jumps while pictures load.
  function preloadSizes(items) {
    return Promise.all(items.map(function (it) {
      return new Promise(function (done) {
        if (!it.thumbnail) return done();
        var im = new Image(), timer = setTimeout(done, 3000);
        im.onload = function () { it._w = im.naturalWidth; it._h = im.naturalHeight; clearTimeout(timer); done(); };
        im.onerror = done;
        im.src = it.thumbnail;
      });
    }));
  }

  function renderPortfolio(data) {
    var grid = $('#portfolioGrid');
    if (!grid) return;
    var all = (data.items || []).filter(function (p) { return p.show !== false && p.title; });
    var filters = $('#filters');

    var kind = 'all';
    function draw() {
      var items = all.filter(function (p) {
        return (kind === 'all' || p.type === kind) && (!workTopic || (p.topics || []).indexOf(workTopic) > -1);
      });
      grid.innerHTML = items.length ? items.map(cardHTML).join('')
        : '<div class="empty">' + (workTopic ? 'Nothing tagged ' + esc(workTopic) + ' in this view yet.' : 'New work is on the way. In the meantime, see my latest videos on Instagram.') + '</div>';
      grid.style.display = items.length ? '' : 'block';
      wireCards(grid, items);
    }
    redrawWork = draw;
    preloadSizes(all).then(draw);
    if (filters) {
      var kinds = 0;
      $all('button', filters).forEach(function (b) {
        var k = b.getAttribute('data-filter');
        if (k === 'all') return;
        var has = all.some(function (p) { return p.type === k; });
        b.hidden = !has; if (has) kinds++;
      });
      if (kinds < 2) filters.hidden = true;
      $all('button', filters).forEach(function (b) {
        b.addEventListener('click', function () {
          $all('button', filters).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          kind = b.getAttribute('data-filter');
          draw();
        });
      });
    }
  }

  function renderClients(brand) {
    $all('[data-clients]').forEach(function (box) {
      var list = (brand && brand.clients) || [];
      if (!list.length) { box.hidden = true; return; }
      box.innerHTML = '<div class="label">' + esc(brand.clients_label || 'Worked with') + '</div><ul>' +
        list.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>';
    });
  }

  /* ---------- Book previews, reviews, events and markets ---------- */
  function renderPreviews(book) {
    var row = $('#peekRow');
    if (!row) return;
    var list = (book.previews || []).filter(function (p) { return p.image; });
    if (!list.length) { $('#peek').hidden = true; return; }
    row.innerHTML = list.map(function (p, i) {
      return '<button type="button" data-i="' + i + '" aria-label="View larger: ' + esc(p.alt) + '">' +
        '<img src="' + esc(p.image) + '" alt="' + esc(p.alt) + '" loading="lazy" decoding="async" width="420" height="280"></button>';
    }).join('');
    var imgs = list.map(function (p) { return { src: p.image, alt: p.alt }; });
    $all('button', row).forEach(function (b) {
      b.addEventListener('click', function () { openImages(imgs, +b.getAttribute('data-i')); });
    });
  }

  function renderReviews(list) {
    var box = $('#reviews');
    if (!box) return;
    list = (list || []).filter(function (r) { return r.text; });
    if (!list.length) { box.hidden = true; return; }
    box.innerHTML = list.map(function (r) {
      return '<figure class="review"><span class="stars" aria-label="5 stars">\u2605\u2605\u2605\u2605\u2605</span>' +
        '<blockquote>' + esc(r.text) + '</blockquote>' +
        (r.name ? '<figcaption class="who">' + esc(r.name) + ', Etsy review</figcaption>' : '') + '</figure>';
    }).join('');
  }

  // Events with a date (YYYY-MM-DD) drop off the site the day after they happen.
  function renderEvents(list) {
    var box = $('#eventList'), section = $('#events');
    if (!box) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    list = (list || []).filter(function (e) {
      if (e.show === false || !e.title) return false;
      if (e.date) { var d = new Date(e.date + 'T23:59:59'); if (!isNaN(d) && d < today) return false; }
      return true;
    }).sort(function (a, b) { return (a.date || '9999') < (b.date || '9999') ? -1 : 1; });
    if (!list.length) { box.hidden = true; return; }
    box.innerHTML = list.map(function (e) {
      var when = e.when || (e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }) : '');
      return '<div class="event"><div>' +
        (when ? '<div class="when">' + esc(when) + '</div>' : '') +
        '<h3>' + esc(e.title) + '</h3>' +
        (e.place ? '<div class="place">' + esc(e.place) + '</div>' : '') +
        (e.details ? '<p>' + esc(e.details) + '</p>' : '') + '</div>' +
        (e.url ? '<a class="btn btn-pink" href="' + esc(e.url) + '">' + esc(e.link_label || 'Details') + '</a>' : '') + '</div>';
    }).join('');
    externalize(box);
  }

  function renderMarkets(m) {
    var box = $('#markets');
    if (!box) return;
    var photos = ((m && m.photos) || []).filter(function (p) { return p.image; });
    if (!photos.length) { box.hidden = true; return; }
    box.hidden = false;
    $('#marketsTitle').textContent = m.title || 'At the markets';
    $('#marketsIntro').textContent = m.intro || '';
    var row = $('#marketRow');
    row.innerHTML = photos.map(function (p, i) {
      return '<figure class="market-photo" data-i="' + i + '" tabindex="0" role="button" aria-label="View larger: ' + esc(p.caption || p.alt || 'market photo') + '">' +
        '<img src="' + esc(p.image) + '" alt="' + esc(p.alt || p.caption || 'Liz at a vendor market') + '" loading="lazy" decoding="async" width="300" height="300">' +
        (p.caption ? '<figcaption>' + esc(p.caption) + '</figcaption>' : '') + '</figure>';
    }).join('');
    var imgs = photos.map(function (p) { return { src: p.image, alt: p.alt || p.caption || '' }; });
    $all('.market-photo', row).forEach(function (f) {
      function go() { openImages(imgs, +f.getAttribute('data-i')); }
      f.addEventListener('click', go);
      f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  /* ---------- Most loved and studio ---------- */
  function renderLoved(loved) {
    var sec = $('#loved'), row = $('#lovedRow'), tabs = $('#lovedTabs'), intro = $('#lovedIntro');
    if (!sec || !loved) return;
    function clean(list) { return (list || []).filter(function (s) { return s.image && s.show !== false; }); }
    var sets = [
      { label: (loved.tabs && loved.tabs[0]) || 'Animations', items: clean(loved.items), intro: loved.intro },
      { label: (loved.tabs && loved.tabs[1]) || 'Influencer videos', items: clean(loved.videos), intro: loved.videos_intro || loved.intro }
    ].filter(function (t) { return t.items.length; });
    if (!sets.length) return;
    sec.hidden = false;
    function draw(k) {
      var set = sets[k];
      if (intro && set.intro) intro.textContent = set.intro;
      row.innerHTML = set.items.map(function (s) {
        return '<a class="loved-card" href="' + esc(s.url || '#') + '">' +
          '<div class="pic"><img src="' + esc(s.image) + '" alt="' + esc(s.title || 'Video by Liz') + '" loading="lazy" decoding="async" width="300" height="466">' +
          (s.brand ? '<span class="brand">' + esc(s.brand) + '</span>' : '') +
          (s.views ? '<span class="views"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="#231d1a"/></svg>' + esc(s.views) + '<span class="sr-only"> views</span></span>' : '') +
          '</div>' + (s.title ? '<div class="t">' + esc(s.title) + '</div>' : '') + '</a>';
      }).join('');
      externalize(row);
    }
    if (sets.length > 1 && tabs) {
      tabs.hidden = false;
      tabs.innerHTML = sets.map(function (t, i) {
        return '<button type="button" class="chip" role="tab" aria-selected="' + (i === 0) + '" data-k="' + i + '">' + esc(t.label) + '</button>';
      }).join('');
      $all('button', tabs).forEach(function (btn) {
        btn.addEventListener('click', function () {
          $all('button', tabs).forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
          btn.setAttribute('aria-selected', 'true'); draw(+btn.getAttribute('data-k'));
        });
      });
    }
    draw(0);
  }

  function renderStudio(studio) {
    var sec = $('#studio'), row = $('#studioRow');
    var items = ((studio && studio.items) || []).filter(function (s) { return s.image; });
    if (!sec || !items.length) return;
    sec.hidden = false;
    row.innerHTML = items.map(function (s) {
      return '<a class="studio-card" href="' + esc(s.url || '#') + '">' +
        '<img src="' + esc(s.image) + '" alt="' + esc(s.caption || 'Behind the scenes in the studio') + '" loading="lazy" decoding="async" width="300" height="466">' +
        '<span class="play-s" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24"><path d="M7 4 L20 12 L7 20 Z" fill="#231d1a"/></svg></span>' +
        (s.caption ? '<span class="cap">' + esc(s.caption) + '</span>' : '') + '</a>';
    }).join('');
    externalize(row);
  }

  /* ---------- Newsletter ---------- */
  function renderLetter(n) {
    var form = $('#letterForm');
    if (!form) return;
    if (!n || n.show === false) { $('#letter').hidden = true; return; }
    var user = (n.buttondown_username || '').trim();
    if (user) {
      form.action = 'https://buttondown.com/api/emails/embed-subscribe/' + encodeURIComponent(user);
    } else {
      form.addEventListener('submit', function (e) { e.preventDefault(); });
      $('#letterBtn').disabled = true;
      $('#letterEmail').disabled = true;
      $('#letterNote').hidden = false;
    }
  }

  /* ---------- Footer: waving characters, scenes, falling leaves ---------- */
  function setupCast(f) {
    var cast = $('#cast'); if (!cast) return;
    if (f && f.style === 'scenes') { cast.hidden = true; $('#ghostBand').hidden = false; return; }
    if (f && f.sky) cast.style.setProperty('--sky', f.sky);
    var bubble = $('#castBubble');
    var lines = (f && f.greetings && f.greetings.length) ? f.greetings : ["so glad you're here!", 'hi friend!', 'take it easy :)', 'you are doing great!'];
    if (bubble) bubble.textContent = lines[0];
    var n = 0;
    $all('.c-pal', cast).forEach(function (b) {
      b.addEventListener('click', function () {
        b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop');
        n = (n + 1) % lines.length; if (bubble) bubble.textContent = lines[n];
      });
      b.addEventListener('animationend', function (e) { if (e.animationName === 'hop') b.classList.remove('hop'); });
    });
  }
  function renderFooter(f) {
    setupCast(f);
    if (!f || f.style !== 'scenes') return;
    var box = $('#footScenes');
    var scenes = ((f && f.scenes) || []).filter(function (s) { return s.image; });
    if (!box || !scenes.length) return;
    if (f.color) $('.site-footer').style.background = f.color;
    var mid = Math.floor(scenes.length / 2);
    box.innerHTML = scenes.map(function (s, i) {
      return '<img class="' + (i === mid ? 'ghosts' : 'scene-card') + '" src="' + esc(s.image) + '" alt="' + esc(s.alt || '') + '" loading="lazy" decoding="async">';
    }).join('');
    if (f.leaves === false) $all('.leaf').forEach(function (l) { l.remove(); });
  }

  function leaves() {
    var band = $('#cast') && !$('#cast').hidden ? $('#cast') : $('#ghostBand');
    if (!band || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#9b3b22', '#c8642b', '#7a2e1c', '#d98a3a'];
    for (var i = 0; i < 9; i++) {
      var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 24 30'); s.setAttribute('class', 'leaf'); s.setAttribute('aria-hidden', 'true');
      s.innerHTML = '<path d="M12 1 C 4 8, 2 18, 12 28 C 22 18, 20 8, 12 1 Z" fill="' + colors[i % 4] + '" stroke="#231d1a" stroke-width="1.2"/><path d="M12 4 L12 27" stroke="#231d1a" stroke-width="1"/>';
      s.style.left = (5 + i * 11) + '%';
      s.style.animationDuration = (7 + (i % 4) * 1.6) + 's';
      s.style.animationDelay = (-i * 1.3) + 's';
      s.style.width = (16 + (i % 3) * 6) + 'px';
      band.appendChild(s);
    }
  }

  /* ---------- Broken image fallback ---------- */
  // If a linked image ever fails (for example an Etsy photo link changes), hide it and keep the soft tile.
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && !t.classList.contains('ghosts')) t.style.visibility = 'hidden';
    if (t && t.classList && t.classList.contains('ghosts')) t.closest('.ghost-band').hidden = true;
  }, true);

  /* ---------- Boot ---------- */
  // Old links like lizpop.art/#book now live on their own pages.
  var MOVED = { '#prints': '/shop/', '#book': '/book/', '#events': '/shop/', '#about': '/about/', '#work': '/portfolio/', '#letter': '/about/#letter' };
  if (page === 'home' && MOVED[location.hash]) { location.replace(MOVED[location.hash]); return; }
  $all('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  externalize(document);
  leaves();

  Promise.all([
    load('site').catch(function () { return null; }),
    $('#printGrid') ? load('prints').catch(function () { return { items: [] }; }) : Promise.resolve(null),
    $('#portfolioGrid') ? load('portfolio').catch(function () { return { items: [] }; }) : Promise.resolve(null),
    $('#qotd') ? load('quotes').catch(function () { return null; }) : Promise.resolve(null)
  ]).then(function (res) {
    var site = res[0], prints = res[1], portfolio = res[2], quotes = res[3];
    if (site) {
      bind(site);
      rotateChips();
      if (site.book) renderPreviews(site.book);
      renderReviews(site.shop && site.shop.reviews);
      renderEvents(site.events);
      renderClients(site.brand);
      renderMarkets(site.markets);
      if ($('#events') && $('#eventList').hidden && (!$('#markets') || $('#markets').hidden)) $('#events').hidden = true;
      if (site.book && !site.book.bonus_url && $('#bonus')) $('#bonus').hidden = true;
      var other = $('#otherLinks');
      if (other && site.book && Array.isArray(site.book.other_links)) {
        other.style.display = 'contents';
        other.innerHTML = site.book.other_links.filter(function (l) { return l.url; }).map(function (l) {
          return '<a class="btn" href="' + esc(l.url) + '">' + esc(l.label) + '</a>';
        }).join('');
      }
    }
    if (site) {
      rotateHeroWords(site.hero); renderHero(site.hero); renderLoved(site.loved); renderStudio(site.studio); renderLetter(site.newsletter); renderFooter(site.footer);
      var pool = doodlePool(site);
      if (quotes) { renderQuotes(quotes, pool); renderMoodBuilder(quotes, pool); }
      renderNature(site.extras); placeDoodles(pool); setupPause(pool);
      setupShare(site.share);
      if (page === 'home') checkGift(site.share);
    }
    if (prints) renderPrints(prints, site && site.shop && site.shop.etsy_url, page === 'home' ? 4 : site && site.shop && site.shop.max_prints, site && site.shop && site.shop.moods, site && site.shop && site.shop.moods_label);
    if (portfolio) renderPortfolio(portfolio);
    externalize(document);
  });
})();