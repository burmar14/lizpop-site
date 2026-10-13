/* Liz Pop Art: loads content/*.json (edited through /admin) and renders the page. */
(function () {
  'use strict';

  var page = document.body.getAttribute('data-page');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function load(name) {
    return fetch('/content/' + name + '.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(name); return r.json(); });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Open links to other sites in a new tab, safely.
  function externalize(root) {
    $all('a[href^="http"]', root).forEach(function (a) {
      if (a.hostname !== location.hostname) { a.target = '_blank'; a.rel = 'noopener'; }
    });
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

  /* ---------- Renderers ---------- */
  function renderPrints(data, etsyUrl) {
    var grid = $('#printGrid');
    if (!grid) return;
    var items = (data.items || []).filter(function (p) { return p.show !== false; });
    if (!items.length) return;
    grid.innerHTML = items.map(function (p) {
      return '<a class="print" href="' + esc(p.etsy_url || etsyUrl) + '">' +
        '<div class="tape"></div><div class="frame">' +
        '<div class="img-box"><img src="' + esc(p.image) + '" alt="' + esc(p.alt || p.title) + '" loading="lazy" decoding="async" width="400" height="500"></div>' +
        '<div class="title">' + esc(p.title) + '</div><div class="cue">See on Etsy</div></div></a>';
    }).join('');
    externalize(grid);
  }

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

  function cardHTML(item, i) {
    var isVideo = item.type === 'video';
    var tags = (item.tags || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    return '<article class="pcard" data-type="' + esc(item.type) + '">' +
      '<button type="button" class="thumb" data-i="' + i + '" aria-label="' + (isVideo ? 'Play video: ' : 'View artwork: ') + esc(item.title) + '">' +
      '<img src="' + esc(item.thumbnail) + '" alt="' + esc(item.alt || item.title) + '" loading="lazy" decoding="async" width="400" height="500">' +
      (isVideo ? '<span class="play" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M7 4 L20 12 L7 20 Z" fill="#231d1a"/></svg></span>' : '') +
      '</button><div class="body">' +
      (item.client ? '<div class="client">' + esc(item.client) + '</div>' : '') +
      '<h3>' + esc(item.title) + '</h3>' +
      (item.description ? '<p>' + esc(item.description) + '</p>' : '') +
      (item.link_url ? '<p><a href="' + esc(item.link_url) + '">See the original post</a></p>' : '') +
      (tags ? '<div class="tags">' + tags + '</div>' : '') +
      '</div></article>';
  }

  function wireCards(root, items) {
    $all('.thumb', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var it = items[+b.getAttribute('data-i')];
        if (it.type === 'video' && it.video_url) { openVideo(it.video_url, it.orientation !== 'horizontal', it.title); return; }
        var imgs = [{ src: it.thumbnail, alt: it.alt || it.title }].concat((it.gallery || []).map(function (g) { return { src: g.image, alt: g.alt || it.title }; }));
        openImages(imgs, 0);
      });
    });
    externalize(root);
  }

  function renderPortfolio(data) {
    var grid = $('#portfolioGrid');
    if (!grid) return;
    var all = (data.items || []).filter(function (p) { return p.show !== false && p.thumbnail; });
    var filters = $('#filters');

    function draw(kind) {
      var items = kind === 'all' ? all : all.filter(function (p) { return p.type === kind; });
      grid.innerHTML = items.length ? items.map(cardHTML).join('')
        : '<div class="empty">New work is on the way. In the meantime, see my latest videos on Instagram.</div>';
      if (!items.length) grid.style.display = 'block'; else grid.style.display = '';
      wireCards(grid, items);
    }
    draw('all');
    if (filters) {
      if (!all.some(function (p) { return p.type === 'video'; }) || !all.some(function (p) { return p.type === 'artwork'; })) filters.hidden = true;
      $all('button', filters).forEach(function (b) {
        b.addEventListener('click', function () {
          $all('button', filters).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          draw(b.getAttribute('data-filter'));
        });
      });
    }
  }

  function renderFeaturedWork(data) {
    var grid = $('#featuredWork');
    if (!grid) return;
    var items = (data.items || []).filter(function (p) { return p.show !== false && p.featured && p.thumbnail; }).slice(0, 3);
    if (!items.length) return;
    grid.innerHTML = items.map(cardHTML).join('');
    grid.hidden = false;
    wireCards(grid, items);
  }

  /* ---------- Quote of the day ---------- */
  // Everyone sees the same quote on a given day; it changes at local midnight.
  function renderQuotes(data) {
    var box = $('#qotd'), btn = $('#qnext');
    if (!box) return;
    var list = (data.items || []).filter(function (q) { return q.show !== false && q.text; }).map(function (q) { return q.text; });
    if (!list.length) { box.closest('section').hidden = true; return; }
    var d = new Date();
    var day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    var i = day % list.length;
    box.textContent = list[i];
    if (!btn) return;
    if (list.length < 2) { btn.hidden = true; return; }
    btn.addEventListener('click', function () {
      var next = i;
      while (next === i) next = Math.floor(Math.random() * list.length);
      i = next;
      box.classList.add('fade');
      setTimeout(function () { box.textContent = list[i]; box.classList.remove('fade'); }, 250);
    });
  }

  /* ---------- Footer leaves ---------- */
  function leaves() {
    var band = $('#ghostBand');
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

  // If a linked image ever fails (for example an Etsy photo link changes), hide it and keep the soft tile.
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && !t.classList.contains('ghosts')) t.style.visibility = 'hidden';
    if (t && t.classList && t.classList.contains('ghosts')) t.closest('.ghost-band').hidden = true;
  }, true);

  /* ---------- Boot ---------- */
  $all('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  externalize(document);
  leaves();

  Promise.all([
    load('site').catch(function () { return null; }),
    page === 'home' ? load('prints').catch(function () { return { items: [] }; }) : Promise.resolve(null),
    load('portfolio').catch(function () { return { items: [] }; }),
    page === 'home' ? load('quotes').catch(function () { return null; }) : Promise.resolve(null)
  ]).then(function (res) {
    var site = res[0], prints = res[1], portfolio = res[2], quotes = res[3];
    if (quotes) renderQuotes(quotes);
    if (site) {
      bind(site);
      if (site.book) renderPreviews(site.book);
      if (site.book && site.book.event_show === false && $('#event')) $('#event').hidden = true;
      if (site.book && !site.book.bonus_url && $('#bonus')) $('#bonus').hidden = true;
      var other = $('#otherLinks');
      if (other && site.book && Array.isArray(site.book.other_links)) {
        other.style.display = 'contents';
        other.innerHTML = site.book.other_links.filter(function (l) { return l.url; }).map(function (l) {
          return '<a class="btn" href="' + esc(l.url) + '">' + esc(l.label) + '</a>';
        }).join('');
      }
    }
    if (prints) renderPrints(prints, site && site.shop && site.shop.etsy_url);
    if (page === 'home') renderFeaturedWork(portfolio);
    if (page === 'portfolio') renderPortfolio(portfolio);
    externalize(document);
  });
})();
