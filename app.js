const SOR_KULCS = 'koltsegek.sor';       // még el nem küldött tételek
const ELOZMENY_KULCS = 'koltsegek.elozmeny'; // utolsó tételek a listához
const CIM_KULCS = 'koltsegek.cim';           // a saját Google szkript címe

const $ = (id) => document.getElementById(id);
const osszegMezo = $('osszeg');
const nevMezo = $('nev');
const uzenet = $('uzenet');
let kivalasztott = null;

function olvas(kulcs) {
  try { return JSON.parse(localStorage.getItem(kulcs)) || []; } catch { return []; }
}
function ir(kulcs, ertek) {
  try { localStorage.setItem(kulcs, JSON.stringify(ertek)); } catch {}
}

const ft = new Intl.NumberFormat('hu-HU');

function cimOlvas() {
  try { return localStorage.getItem(CIM_KULCS) || ''; } catch { return ''; }
}
let scriptCim = cimOlvas();

// Kategória gombok
function kategoriakRajzol() {
  const doboz = $('kategoriak');
  doboz.innerHTML = '';
  KATEGORIAK.forEach((k) => {
    const gomb = document.createElement('button');
    gomb.type = 'button';
    gomb.className = 'kategoria';
    gomb.setAttribute('role', 'radio');
    gomb.setAttribute('aria-checked', String(kivalasztott === k.nev));
    gomb.innerHTML = `<span class="ikon">${k.ikon}</span><span>${k.nev}</span>`;
    gomb.addEventListener('click', () => {
      kivalasztott = k.nev;
      kategoriakRajzol();
    });
    doboz.appendChild(gomb);
  });
}

// Összeg mező: csak számjegyek, ezres tagolással
osszegMezo.addEventListener('input', () => {
  const szam = osszegMezo.value.replace(/\D/g, '').slice(0, 9);
  osszegMezo.value = szam ? ft.format(Number(szam)) : '';
});

function uzen(szoveg, tipus = '') {
  uzenet.textContent = szoveg;
  uzenet.className = 'uzenet ' + tipus;
}

function listaRajzol() {
  const sor = new Set(olvas(SOR_KULCS).map((t) => t.id));
  const lista = $('lista');
  lista.innerHTML = '';
  const elozmeny = olvas(ELOZMENY_KULCS);
  if (!elozmeny.length) {
    lista.innerHTML = '<li class="ures">Még nincs bejegyzés.</li>';
    return;
  }
  elozmeny.forEach((t) => {
    const li = document.createElement('li');
    const datum = new Date(t.datum).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
    const allapot = sor.has(t.id) ? '⏳' : '✓';
    li.innerHTML = `
      <div><strong></strong><small></small></div>
      <div class="jobb"><span class="ft"></span><span class="allapot" title="${sor.has(t.id) ? 'Küldésre vár' : 'Elmentve a táblázatba'}">${allapot}</span></div>`;
    li.querySelector('strong').textContent = t.nev || t.kategoria;
    li.querySelector('small').textContent = `${t.kategoria} · ${datum}`;
    li.querySelector('.ft').textContent = ft.format(t.osszeg) + ' Ft';
    lista.appendChild(li);
  });
}

let kuldesFolyamatban = false;
async function sorKuldes() {
  if (kuldesFolyamatban || !scriptCim) return;
  kuldesFolyamatban = true;
  try {
    let sor = olvas(SOR_KULCS);
    while (sor.length) {
      const tetel = sor[0];
      // text/plain: így nem kell CORS előzetes kérés az Apps Script felé
      const valasz = await fetch(scriptCim, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(tetel),
      });
      const adat = await valasz.json();
      if (!adat.ok) throw new Error(adat.hiba || 'Ismeretlen hiba');
      sor = olvas(SOR_KULCS).filter((t) => t.id !== tetel.id);
      ir(SOR_KULCS, sor);
      listaRajzol();
    }
    return true;
  } catch (hiba) {
    console.warn(hiba);
    return false;
  } finally {
    kuldesFolyamatban = false;
  }
}

$('urlap').addEventListener('submit', async (e) => {
  e.preventDefault();
  const osszeg = Number(osszegMezo.value.replace(/\D/g, ''));
  if (!osszeg) { uzen('Írd be az összeget.', 'hiba'); osszegMezo.focus(); return; }
  if (!kivalasztott) { uzen('Válassz kategóriát.', 'hiba'); return; }

  const tetel = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    datum: new Date().toISOString(),
    nev: nevMezo.value.trim(),
    osszeg,
    kategoria: kivalasztott,
  };
  ir(SOR_KULCS, [...olvas(SOR_KULCS), tetel]);
  ir(ELOZMENY_KULCS, [tetel, ...olvas(ELOZMENY_KULCS)].slice(0, 15));

  osszegMezo.value = '';
  nevMezo.value = '';
  kivalasztott = null;
  kategoriakRajzol();
  listaRajzol();

  if (!scriptCim) {
    uzen('Elmentve a telefonon. A táblázat még nincs összekötve.', 'figyelem');
    return;
  }
  uzen('Mentés…');
  const siker = await sorKuldes();
  uzen(siker ? `Elmentve: ${ft.format(osszeg)} Ft` : 'Nincs net? Elmentve a telefonon, később elküldöm.', siker ? 'ok' : 'figyelem');
});

function halozatJelzo() {
  $('halozat').hidden = navigator.onLine;
  if (navigator.onLine) sorKuldes().then(listaRajzol);
}
window.addEventListener('online', halozatJelzo);
window.addEventListener('offline', halozatJelzo);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') sorKuldes().then(listaRajzol);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Beállító képernyő: itt adja meg mindenki a saját táblázatának címét.
const CIM_MINTA = /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/;

function beallitasMutat(mutat) {
  $('beallitas').hidden = !mutat;
  $('fooldal').hidden = mutat;
  $('megse').hidden = !scriptCim;
  $('beallitasUzenet').textContent = '';
  if (mutat) $('cim').value = scriptCim;
  else osszegMezo.focus();
}

$('beallitasGomb').addEventListener('click', () => beallitasMutat($('beallitas').hidden));
$('megse').addEventListener('click', () => beallitasMutat(false));

$('beallitasUrlap').addEventListener('submit', async (e) => {
  e.preventDefault();
  const uz = $('beallitasUzenet');
  const cim = $('cim').value.trim().split('?')[0];
  if (!CIM_MINTA.test(cim)) {
    uz.textContent = 'Ez nem jó cím. https://script.google.com/macros/s/ kezdetű és /exec végű címet keresünk.';
    uz.className = 'uzenet hiba';
    return;
  }
  uz.textContent = 'Ellenőrzöm…';
  uz.className = 'uzenet';
  let ellenorizve = false;
  try {
    const adat = await (await fetch(cim)).json();
    if (!adat.ok) throw new Error('nem ok');
    ellenorizve = true;
  } catch {
    // Ha nem sikerül ellenőrizni (pl. nincs net), a címet akkor is elmentjük.
  }
  try { localStorage.setItem(CIM_KULCS, cim); } catch {}
  scriptCim = cim;
  beallitasMutat(false);
  uzen(ellenorizve ? 'Összekötve a táblázattal ✓' : 'Elmentettem a címet, de most nem tudtam ellenőrizni. Ments egy tételt, és nézd meg a táblázatban.', ellenorizve ? 'ok' : 'figyelem');
  sorKuldes().then(listaRajzol);
});

kategoriakRajzol();
listaRajzol();
halozatJelzo();
beallitasMutat(!scriptCim);
