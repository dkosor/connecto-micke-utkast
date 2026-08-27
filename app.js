/* Micke Bernakiewicz / Connecto Bedriftsmegling
   Tier-1: layered depth parallax on the hero, driven by pointer AND scroll.
   Everything else is motivated reveal. Transform and stroke only, never opacity to zero. */

(() => {
  'use strict';
  const q  = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -- 1. hero parallax rig -------------------------------------------- */
  const hero = q('.hero');
  if (hero && !reduce) {
    // attach unless the primary input is a finger: a touch drag moving the
    // hero layers reads as a glitch, a mouse moving them reads as depth
    let tx = 0, ty = 0, cx = 0, cy = 0, sy = 0, raf = 0;
    const fine = !matchMedia('(pointer: coarse)').matches;

    const onMove = e => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      ty = ((e.clientY - r.top)  / r.height - 0.5) * 2;
      start();
    };
    const onScroll = () => {
      const r = hero.getBoundingClientRect();
      sy = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      start();
    };
    const tick = () => {
      cx += (tx - cx) * 0.075;
      cy += (ty - cy) * 0.075;
      hero.style.setProperty('--mx', cx.toFixed(4));
      hero.style.setProperty('--my', cy.toFixed(4));
      hero.style.setProperty('--sy', sy.toFixed(4));
      raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(tick) : 0;
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(tick); };

    if (fine) hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; start(); }, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -- 2. sticky nav border -------------------------------------------- */
  const nav = q('#nav');
  if (nav) {
    const onS = () => nav.classList.toggle('is-stuck', scrollY > 8);
    addEventListener('scroll', onS, { passive: true });
    onS();
  }

  /* -- 3. rules and ticks draw in on entry ------------------------------ */
  if ('IntersectionObserver' in window && !reduce) {
    const rules = qa('.rule');
    rules.forEach(r => r.style.setProperty('--rx', '0'));
    const ticks = qa('.tl li');

    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        if (el.classList.contains('rule')) {
          el.style.setProperty('--rx', '1');
        } else {
          const i = ticks.indexOf(el);
          setTimeout(() => el.style.setProperty('--tx', '1'), Math.max(0, i) * 90);
        }
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });

    rules.forEach(r => io.observe(r));
    ticks.forEach(t => io.observe(t));
  } else {
    qa('.tl li').forEach(t => t.style.setProperty('--tx', '1'));
  }

  /* -- 4. index rail + nav highlighting --------------------------------- */
  const secs = qa('[data-sec]');
  const dots = qa('.railidx li');
  const navLinks = qa('.nav__links a');
  if (secs.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const n = en.target.dataset.sec;
        dots.forEach(d => d.classList.toggle('is-on', d.dataset.i === n));
        const id = en.target.id;
        navLinks.forEach(a => a.classList.toggle('is-on', a.getAttribute('href') === '#' + id));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    secs.forEach(s => spy.observe(s));
  }

  /* -- 5. the thirteen steps -------------------------------------------- */
  const tabs = qa('.steps button');
  const out  = {
    n:    q('[data-out="n"]'),
    navn: q('[data-out="navn"]'),
    d:    q('[data-out="d"]')
  };
  const paint = btn => {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t === btn)));
    if (!out.n) return;
    [out.n, out.navn, out.d].forEach(el => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
    out.n.textContent    = btn.dataset.n;
    out.navn.innerHTML   = btn.dataset.navn;
    out.d.innerHTML      = btn.dataset.d;
  };
  tabs.forEach((btn, i) => {
    btn.addEventListener('click', () => paint(btn));
    btn.addEventListener('mouseenter', () => paint(btn));
    btn.addEventListener('focus', () => paint(btn));
    btn.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus();
    });
  });

  /* -- 6. the rhinoceros draws itself in the contact block --------------- */
  const draw = qa('.kontakt__rhino .rh-draw');
  if (draw.length) {
    draw.forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray  = len;
      p.style.strokeDashoffset = reduce ? 0 : len;
    });
    if (!reduce && 'IntersectionObserver' in window) {
      const kio = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          draw.forEach((p, i) => {
            p.style.transition = `stroke-dashoffset 1.5s cubic-bezier(.22,.61,.36,1) ${i * 0.075}s`;
            p.style.strokeDashoffset = '0';
          });
          kio.disconnect();
        });
      }, { threshold: 0.16 });
      kio.observe(q('.kontakt'));
    } else {
      draw.forEach(p => { p.style.strokeDashoffset = '0'; });
    }
  }
})();
