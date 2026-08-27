/* Skjema for selgere. No dependencies, no tracking, nothing leaves the browser
   until the seller presses send.

   ENDPOINT: leave empty and the form ends in a copy-and-send-by-mail receipt,
   which works with no backend at all. Put a URL here (the WordPress form
   plugin's REST route, a Netlify/Cloudflare function, a form service) and the
   same payload is POSTed as JSON instead. Nothing else has to change. */
const ENDPOINT = '';

(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const q  = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];

  const form    = q('#form');
  const steg    = qa('.sk-steg');
  const rail    = qa('.sk-rail button');
  const neste   = q('#neste');
  const tilbake = q('#tilbake');
  const send    = q('#send');
  const lagret  = q('#lagret');
  const stegtall= q('#stegtall');
  const barfyll = q('#barfyll');
  const NOKKEL  = 'connecto-selgerskjema-v2';
  const rolig   = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -- the shape of the dossier ---------------------------------------- */
  const GRUPPER = [
    { navn: 'Deg', felt: [
      ['navn','Navn'], ['rolle','Rolle'], ['telefon','Telefon'],
      ['epost','E-post'], ['naar','Kan ringes'] ] },
    { navn: 'Bedriften', felt: [
      ['selskap','Selskap'], ['orgnr','Org.nr'], ['sted','Sted'],
      ['bransje','Bransje'], ['etablert','Etablert'], ['ansatte','Ansatte'] ] },
    { navn: 'Tall', felt: [
      ['omsetning','Omsetning'], ['resultat','Driftsresultat'], ['margin','Driftsmargin'],
      ['lokaler','Lokaler'], ['kunder','Kunder'] ] },
    { navn: 'Planen', felt: [
      ['maal','\u00d8nske'], ['tid','Tidshorisont'], ['overgang','Overgangsperiode'],
      ['interesse','Interessenter'], ['tidligere','Snakket med megler'],
      ['viktigst','Viktigst i et salg'], ['annet','Annet'] ] }
  ];
  const STEG_FOR_FELT = {};
  GRUPPER.forEach((g, i) => g.felt.forEach(([n]) => { STEG_FOR_FELT[n] = i; }));

  /* -- reading and writing values, whatever the control is -------------- */
  function verdi(navn) {
    const el = form.elements[navn];
    if (!el) return '';
    if (el instanceof RadioNodeList || (el.length && !el.tagName)) {
      const liste = [...el];
      if (liste[0] && liste[0].type === 'checkbox') {
        return liste.filter(x => x.checked).map(x => x.value).join(', ');
      }
      return el.value || '';
    }
    return (el.value || '').trim();
  }

  function settVerdi(navn, v) {
    const el = form.elements[navn];
    if (!el || !v) return;
    if (el instanceof RadioNodeList || (el.length && !el.tagName)) {
      const liste = [...el];
      if (liste[0] && liste[0].type === 'checkbox') {
        const valgte = v.split(',').map(s => s.trim());
        liste.forEach(x => { x.checked = valgte.includes(x.value); });
      } else {
        liste.forEach(x => { x.checked = x.value === v; });
      }
    } else {
      el.value = v;
    }
  }

  function samle() {
    const d = {};
    GRUPPER.forEach(g => g.felt.forEach(([n]) => { d[n] = verdi(n); }));
    return d;
  }

  /* -- step machine ----------------------------------------------------- */
  let naa = 0;
  const SISTE = steg.length - 1;

  function vis(i, flytt = true) {
    naa = Math.max(0, Math.min(SISTE, i));
    steg.forEach((s, k) => { s.hidden = k !== naa; });
    rail.forEach((b, k) => {
      if (k === naa) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    tilbake.hidden = naa === 0;
    neste.hidden   = naa === SISTE;
    send.hidden    = naa !== SISTE;
    stegtall.textContent = 'Steg ' + (naa + 1) + ' av ' + (SISTE + 1);
    barfyll.style.setProperty('--p', ((naa + 1) / (SISTE + 1)).toFixed(3));
    if (naa === SISTE) byggOppsummering();
    if (flytt) {
      const nav = q('#nav');
      const h = nav ? nav.getBoundingClientRect().height : 0;
      const t = q('.sk-fremdrift').getBoundingClientRect().top + scrollY - h - 20;
      scrollTo({ top: t, behavior: rolig ? 'auto' : 'smooth' });
    }
    merkFerdige();
  }

  function merkFerdige() {
    GRUPPER.forEach((g, i) => {
      const fylt = g.felt.some(([n]) => verdi(n));
      if (fylt && i !== naa) rail[i].dataset.ferdig = 'ja';
      else delete rail[i].dataset.ferdig;
    });
  }

  neste.addEventListener('click', () => { if (sjekkSteg(naa)) vis(naa + 1); });
  tilbake.addEventListener('click', () => vis(naa - 1));
  rail.forEach(b => b.addEventListener('click', () => vis(+b.dataset.go)));

  /* -- validation ------------------------------------------------------- */
  function feil(el, tekst) {
    const boks = el.closest('.f, .sk-samtykke');
    const ut = boks && boks.querySelector('[data-feil]');
    if (boks) boks.classList.toggle('f--feil', !!tekst);
    if (ut) ut.textContent = tekst || '';
  }

  function sjekkFelt(el) {
    const v = (el.value || '').trim();
    if (el.id === 'navn' && !v) return 'Vi trenger navnet ditt';
    if (el.id === 'telefon') {
      if (!v) return 'Vi trenger et telefonnummer';
      if ((v.match(/\d/g) || []).length < 8) return 'Sjekk nummeret, det ser for kort ut';
    }
    if (el.id === 'epost') {
      if (!v) return 'Vi trenger en e-postadresse';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Sjekk e-postadressen';
    }
    if (el.id === 'samtykke' && !el.checked) return 'Du m\u00e5 samtykke for \u00e5 sende';
    return '';
  }

  function sjekkSteg(i) {
    const felter = qa('input, textarea', steg[i]).filter(e => e.required);
    let forste = null;
    felter.forEach(el => {
      const f = sjekkFelt(el);
      feil(el, f);
      if (f && !forste) forste = el;
    });
    if (forste) { forste.focus(); return false; }
    return true;
  }

  form.addEventListener('input', e => {
    if (e.target.closest('.f--feil, .sk-samtykke')) feil(e.target, sjekkFelt(e.target));
    lagre();
  });
  form.addEventListener('change', () => { lagre(); merkFerdige(); });

  /* -- chips ------------------------------------------------------------- */
  // a chip that fills a text field: tap to set, tap again to clear
  qa('.chips--fyll').forEach(gruppe => {
    const mal = form.elements[gruppe.dataset.fyll];
    const knapper = qa('button', gruppe);
    const speil = () => knapper.forEach(b =>
      b.classList.toggle('er-valgt', b.value === mal.value));
    knapper.forEach(b => b.addEventListener('click', () => {
      mal.value = (mal.value === b.value) ? '' : b.value;
      speil(); lagre(); merkFerdige();
    }));
    mal.addEventListener('input', speil);
    speil();
  });

  // a chip that appends a phrase to a textarea, so nobody has to compose from scratch
  qa('.chips--legg').forEach(gruppe => {
    const mal = form.elements[gruppe.dataset.legg];
    const knapper = qa('button', gruppe);
    const speil = () => knapper.forEach(b =>
      b.classList.toggle('er-valgt', mal.value.includes(b.value)));
    knapper.forEach(b => b.addEventListener('click', () => {
      const har = mal.value.includes(b.value);
      if (har) {
        mal.value = mal.value
          .split(/\.\s*/).filter(s => s.trim() && s.trim() !== b.value)
          .map(s => s.trim()).join('. ');
        if (mal.value) mal.value += '.';
      } else {
        mal.value = (mal.value.trim() ? mal.value.trim().replace(/\.?$/, '. ') : '') + b.value + '.';
      }
      speil(); lagre(); merkFerdige();
    }));
    mal.addEventListener('input', speil);
    speil();
  });

  /* -- autosave in the seller's own browser ----------------------------- */
  let lagreTimer = 0;
  function lagre() {
    clearTimeout(lagreTimer);
    lagreTimer = setTimeout(() => {
      try {
        localStorage.setItem(NOKKEL, JSON.stringify(samle()));
        lagret.textContent = 'Lagret';
        lagret.classList.add('vis');
        setTimeout(() => lagret.classList.remove('vis'), 1600);
      } catch (e) { /* private browsing, fine */ }
    }, 500);
  }

  (function gjenopprett() {
    let d;
    try { d = JSON.parse(localStorage.getItem(NOKKEL) || 'null'); } catch (e) { return; }
    if (!d) return;
    Object.entries(d).forEach(([n, v]) => settVerdi(n, v));
    qa('.chips--fyll button, .chips--legg button').forEach(b => {
      const gruppe = b.closest('[data-fyll], [data-legg]');
      const mal = form.elements[gruppe.dataset.fyll || gruppe.dataset.legg];
      b.classList.toggle('er-valgt',
        gruppe.dataset.fyll ? mal.value === b.value : mal.value.includes(b.value));
    });
    merkFerdige();
  })();

  q('#tom').addEventListener('click', () => {
    if (!confirm('T\u00f8mme alt du har fylt ut?')) return;
    try { localStorage.removeItem(NOKKEL); } catch (e) {}
    form.reset();
    qa('.er-valgt').forEach(b => b.classList.remove('er-valgt'));
    qa('.f--feil').forEach(b => b.classList.remove('f--feil'));
    qa('[data-feil]').forEach(b => { b.textContent = ''; });
    vis(0);
  });

  /* -- company search against Enhetsregisteret --------------------------- */
  const sok     = q('#sok');
  const treff   = q('#treff');
  const snurr   = q('#snurr');
  const soknote = q('#soknote');
  const STANDARDNOTE = soknote.textContent;
  let sokTimer = 0, aktiv = -1, siste = '';

  const API = 'https://data.brreg.no/enhetsregisteret/api/enheter';

  function lukk() {
    treff.hidden = true;
    treff.textContent = '';
    sok.setAttribute('aria-expanded', 'false');
    aktiv = -1;
  }

  function fyllFra(e) {
    const sett = (id, v) => { if (v) form.elements[id].value = String(v); };
    sett('selskap', e.navn);
    sett('orgnr', e.organisasjonsnummer);
    sett('sted', e.forretningsadresse && e.forretningsadresse.poststed);
    sett('bransje', e.naeringskode1 && e.naeringskode1.beskrivelse);
    sett('etablert', e.stiftelsesdato && e.stiftelsesdato.slice(0, 4));
    if (e.antallAnsatte != null) sett('ansatte', String(e.antallAnsatte));
    qa('.chips--fyll button').forEach(b => {
      const mal = form.elements[b.closest('[data-fyll]').dataset.fyll];
      b.classList.toggle('er-valgt', mal.value === b.value);
    });
    soknote.dataset.ok = 'ja';
    soknote.textContent = 'Hentet ' + e.navn + '. Rett gjerne p\u00e5 det som ikke stemmer.';
    sok.value = '';
    lukk();
    lagre(); merkFerdige();
  }

  // Brreg matches any token and returns them shortest-name-first, not by
  // relevance, so the ranking has to happen here. Diacritics are folded because
  // people type "radgivende" as often as they type "r\u00e5dgivende".
  function fold(s) {
    return s.toLowerCase()
      .replace(/\u00e6/g, 'ae').replace(/\u00f8/g, 'o').replace(/\u00e5/g, 'a')
      .replace(/[\u00e9\u00e8\u00ea]/g, 'e').replace(/\u00f6/g, 'o').replace(/\u00e4/g, 'a')
      .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function poeng(navn, ord, form_) {
    const n = fold(navn);
    let p = 0;
    ord.forEach(o => { if (n.includes(o)) p += 100; });
    if (n.startsWith(ord.join(' '))) p += 60;
    if (form_ === 'AS' || form_ === 'ASA') p += 8;
    return p - n.length * 0.15;
  }

  async function hent(sporring) {
    const ord = fold(sporring).split(' ').filter(Boolean);
    // the whole phrase, plus each word on its own: any one of them may be the
    // token that actually lands the company
    const sporringer = [sporring];
    sporring.split(/\s+/).filter(o => o.length >= 4).slice(0, 3)
      .forEach(o => { if (o !== sporring) sporringer.push(o); });
    const svar = await Promise.all(sporringer.slice(0, 4).map(sp =>
      fetch(API + '?navn=' + encodeURIComponent(sp) + '&size=100')
        .then(r => r.ok ? r.json() : null).catch(() => null)));
    const sett = new Map();
    svar.forEach(j => {
      const liste = (j && j._embedded && j._embedded.enheter) || [];
      liste.forEach(e => { if (!e.slettedato) sett.set(e.organisasjonsnummer, e); });
    });
    return [...sett.values()]
      .map(e => ({ e, p: poeng(e.navn, ord, e.organisasjonsform && e.organisasjonsform.kode) }))
      .filter(x => x.p > 60)
      .sort((a, b) => b.p - a.p)
      .slice(0, 8)
      .map(x => x.e);
  }

  function tegn(liste) {
    treff.textContent = '';
    if (!liste.length) {
      const li = document.createElement('li');
      const p = document.createElement('p');
      p.className = 'sk-treff__tom';
      p.textContent = 'Fant ingen. Skriv inn feltene under selv, det g\u00e5r like bra.';
      li.appendChild(p);
      treff.appendChild(li);
    } else {
      liste.forEach((e, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        const b = document.createElement('button');
        b.type = 'button';
        const navn = document.createElement('span');
        navn.className = 'sk-treff__navn';
        navn.textContent = e.navn;
        const meta = document.createElement('span');
        meta.className = 'sk-treff__meta';
        const biter = [e.organisasjonsnummer];
        if (e.forretningsadresse && e.forretningsadresse.poststed) biter.push(e.forretningsadresse.poststed);
        if (e.organisasjonsform && e.organisasjonsform.kode) biter.push(e.organisasjonsform.kode);
        if (e.antallAnsatte != null) biter.push(e.antallAnsatte + ' ansatte');
        meta.textContent = biter.join('  \u00b7  ');
        b.append(navn, meta);
        b.addEventListener('click', () => fyllFra(e));
        li.appendChild(b);
        treff.appendChild(li);
      });
    }
    treff.hidden = false;
    sok.setAttribute('aria-expanded', 'true');
    aktiv = -1;
  }

  function merkAktiv(retning) {
    const rader = qa('li', treff).filter(li => q('button', li));
    if (!rader.length) return;
    aktiv = (aktiv + retning + rader.length) % rader.length;
    rader.forEach((li, i) => li.classList.toggle('er-aktiv', i === aktiv));
    rader[aktiv].scrollIntoView({ block: 'nearest' });
  }

  // A published preview blocks every request that leaves the page, and so does a
  // register outage. Either way the search box is dead weight, so find out once
  // on load and say so plainly instead of leaving a box that does nothing.
  let sokVirker = null;
  function slaaAvSok(grunn) {
    sokVirker = false;
    const boks = q('.sk-sok__boks');
    if (boks) boks.hidden = true;
    const merke = q('label[for="sok"]');
    if (merke) merke.hidden = true;
    lukk();
    soknote.dataset.ok = 'nei';
    soknote.textContent = grunn;
  }

  (async function proevSok() {
    try {
      const stopp = new AbortController();
      const klokke = setTimeout(() => stopp.abort(), 7000);
      const r = await fetch(API + '/987314311', { signal: stopp.signal });
      clearTimeout(klokke);
      if (!r.ok) throw new Error('status ' + r.status);
      sokVirker = true;
    } catch (e) {
      const iRamme = (function () { try { return window.self !== window.top; } catch (x) { return true; } })();
      slaaAvSok(iRamme
        ? 'Selskapss\u00f8ket er sl\u00e5tt av i denne forh\u00e5ndsvisningen, fordi forh\u00e5ndsvisningen ikke f\u00e5r hente data utenfra. P\u00e5 den ferdige siden fyller det ut feltene under automatisk. Skriv dem inn selv her.'
        : 'F\u00e5r ikke kontakt med Enhetsregisteret akkurat n\u00e5. Skriv inn feltene under selv, det g\u00e5r like bra.');
    }
  })();

  sok.addEventListener('input', () => {
    if (sokVirker === false) return;
    const v = sok.value.trim();
    soknote.dataset.ok = '';
    soknote.textContent = STANDARDNOTE;
    clearTimeout(sokTimer);
    if (v.length < 2) { lukk(); snurr.hidden = true; return; }
    sokTimer = setTimeout(async () => {
      siste = v;
      snurr.hidden = false;
      try {
        const bare = v.replace(/\D/g, '');
        let liste;
        if (bare.length === 9 && /^[\d\s]+$/.test(v)) {
          const r = await fetch(API + '/' + bare);
          liste = r.ok ? [await r.json()] : [];
        } else {
          liste = await hent(v);
        }
        if (siste !== v) return;
        tegn(liste);
      } catch (e) {
        soknote.dataset.ok = 'nei';
        soknote.textContent = 'Fikk ikke kontakt med Enhetsregisteret. Skriv inn feltene under selv.';
        lukk();
      } finally {
        snurr.hidden = true;
      }
    }, 320);
  });

  sok.addEventListener('keydown', e => {
    if (treff.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); merkAktiv(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); merkAktiv(-1); }
    else if (e.key === 'Enter') {
      const rad = qa('li.er-aktiv button', treff)[0];
      if (rad) { e.preventDefault(); rad.click(); }
    } else if (e.key === 'Escape') { lukk(); }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.sk-sok')) lukk();
  });

  /* -- review ------------------------------------------------------------ */
  function byggOppsummering() {
    const d = samle();
    const ut = q('#oppsum');
    ut.textContent = '';
    GRUPPER.forEach(g => {
      const boks = document.createElement('div');
      boks.className = 'sk-oppsum__gruppe';
      const k = document.createElement('p');
      k.className = 'sk-oppsum__k';
      k.textContent = g.navn;
      boks.appendChild(k);
      const dl = document.createElement('dl');
      g.felt.forEach(([n, etikett]) => {
        const rad = document.createElement('div');
        rad.className = 'sk-rad';
        const dt = document.createElement('dt');
        dt.textContent = etikett;
        const dd = document.createElement('dd');
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = d[n] || 'ikke oppgitt';
        if (!d[n]) b.className = 'sk-tomt';
        b.addEventListener('click', () => {
          vis(STEG_FOR_FELT[n]);
          setTimeout(() => {
            const el = form.elements[n];
            const mal = (el instanceof RadioNodeList || (el.length && !el.tagName)) ? el[0] : el;
            if (mal && mal.focus) mal.focus();
          }, 280);
        });
        dd.appendChild(b);
        rad.append(dt, dd);
        dl.appendChild(rad);
      });
      boks.appendChild(dl);
      ut.appendChild(boks);
    });
  }

  /* -- the finished dossier, as plain text ------------------------------- */
  function somTekst() {
    const d = samle();
    const linjer = ['Henvendelse fra selger, via nettskjema', ''];
    GRUPPER.forEach(g => {
      const rader = g.felt.filter(([n]) => d[n]);
      if (!rader.length) return;
      linjer.push(g.navn.toUpperCase());
      rader.forEach(([n, etikett]) => linjer.push('  ' + etikett + ': ' + d[n]));
      linjer.push('');
    });
    linjer.push('Samtykke til lagring og kontakt: ja');
    return linjer.join('\n');
  }

  /* -- submit ------------------------------------------------------------ */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    for (let i = 0; i <= SISTE; i++) {
      if (!sjekkSteg(i)) { vis(i); return; }
    }

    const data = samle();
    data.samtykke = 'ja';
    data.side = location.href;

    const etikett = q('.tab__l', send);
    const opprinnelig = etikett.textContent;
    send.disabled = true;
    etikett.textContent = 'Sender...';

    let sendtAutomatisk = false;
    if (ENDPOINT) {
      try {
        const r = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        sendtAutomatisk = r.ok;
      } catch (err) { sendtAutomatisk = false; }
    }

    etikett.textContent = opprinnelig;
    send.disabled = false;
    visKvittering(sendtAutomatisk);
  });

  function visKvittering(automatisk) {
    const tekst = somTekst();
    form.hidden = true;
    q('.sk-fremdrift').hidden = true;
    q('.sk-tom').hidden = true;
    const kv = q('#kvittering');
    kv.hidden = false;

    const hva = q('#kvitteringHva');
    hva.textContent = '';

    if (automatisk) {
      try { localStorage.removeItem(NOKKEL); } catch (e) {}
    } else {
      const p = document.createElement('p');
      p.className = 'sk-hjelp';
      p.textContent = 'Siste steg: send opplysningene til Micke. Trykk knappen under, ' +
        's\u00e5 \u00e5pnes e-posten din ferdig utfylt. Eller kopier teksten og send den slik du vil.';
      const pre = document.createElement('pre');
      pre.textContent = tekst;
      const knapper = document.createElement('div');
      knapper.className = 'sk-kvittering__knapper';

      const d = samle();
      const mail = document.createElement('a');
      mail.className = 'tab tab--stor';
      mail.href = 'mailto:micke@connecto.no?subject=' +
        encodeURIComponent('Henvendelse fra selger' + (d.selskap ? ', ' + d.selskap : '')) +
        '&body=' + encodeURIComponent(tekst);
      const ml = document.createElement('span');
      ml.className = 'tab__l';
      ml.textContent = '\u00c5pne i e-post';
      mail.appendChild(ml);

      const kopi = document.createElement('button');
      kopi.type = 'button';
      kopi.className = 'tab tab--stor tab--send';
      const kl = document.createElement('span');
      kl.className = 'tab__l';
      kl.textContent = 'Kopier alt';
      kopi.appendChild(kl);
      kopi.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(tekst);
          kl.textContent = 'Kopiert';
        } catch (err) {
          const r = document.createRange();
          r.selectNodeContents(pre);
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
          kl.textContent = 'Merket, trykk kopier';
        }
        setTimeout(() => { kl.textContent = 'Kopier alt'; }, 2400);
      });

      knapper.append(mail, kopi);
      hva.append(p, pre, knapper);
    }

    kv.scrollIntoView({ behavior: rolig ? 'auto' : 'smooth' });
  }

  /* -- sticky nav border, same as the profile page ----------------------- */
  const nav = q('#nav');
  const onS = () => nav.classList.toggle('is-stuck', scrollY > 8);
  addEventListener('scroll', onS, { passive: true });
  onS();

  /* -- the rhinoceros draws itself in the contact block ------------------ */
  const draw = qa('.kontakt__rhino .rh-draw');
  if (draw.length) {
    draw.forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = rolig ? 0 : len;
    });
    if (!rolig && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(en => {
        en.forEach(x => {
          if (!x.isIntersecting) return;
          draw.forEach((p, i) => {
            p.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.16,.84,.24,1) ' + (i * 0.075) + 's';
            p.style.strokeDashoffset = '0';
          });
          io.disconnect();
        });
      }, { threshold: 0.16 });
      io.observe(q('.kontakt'));
    }
  }

  vis(0, false);
})();
