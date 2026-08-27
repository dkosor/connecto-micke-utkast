/* Oversiktssiden. Samme bevegelsesspr\u00e5k som resten: streker som tegnes inn,
   og neshornet som tegner seg selv i bunnen. Ingen avhengigheter. */
(() => {
  'use strict';
  const q  = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const rolig = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* sticky nav, som p\u00e5 de andre sidene */
  const nav = q('#nav');
  if (nav) {
    const paaScroll = () => nav.classList.toggle('is-stuck', scrollY > 8);
    addEventListener('scroll', paaScroll, { passive: true });
    paaScroll();
  }

  /* h\u00e5rfine streker tegner seg inn. Bare transform, aldri opacity til null,
     s\u00e5 et fullsides skjermbilde viser alt uansett */
  if ('IntersectionObserver' in window && !rolig) {
    const streker = qa('.rule');
    streker.forEach(r => r.style.setProperty('--rx', '0'));
    const io = new IntersectionObserver(en => {
      en.forEach(x => {
        if (!x.isIntersecting) return;
        x.target.style.setProperty('--rx', '1');
        io.unobserve(x.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    streker.forEach(r => io.observe(r));
  }

  /* aktiv seksjon i navigasjonen */
  const seksjoner = qa('[data-sec]');
  const lenker = qa('.nav__links a');
  if (seksjoner.length && 'IntersectionObserver' in window) {
    const spion = new IntersectionObserver(en => {
      en.forEach(x => {
        if (!x.isIntersecting) return;
        const id = x.target.id;
        lenker.forEach(a => a.classList.toggle('is-on', a.getAttribute('href') === '#' + id));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    seksjoner.forEach(s => spion.observe(s));
  }

  /* neshornet tegner seg selv i bunnen */
  const strek = qa('.ov-foot__rhino .rh-draw');
  if (strek.length) {
    strek.forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = rolig ? 0 : len;
    });
    if (!rolig && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(en => {
        en.forEach(x => {
          if (!x.isIntersecting) return;
          strek.forEach((p, i) => {
            p.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.16,.84,.24,1) ' + (i * 0.075) + 's';
            p.style.strokeDashoffset = '0';
          });
          io.disconnect();
        });
      }, { threshold: 0.16 });
      io.observe(q('.ov-foot'));
    }
  }
})();
