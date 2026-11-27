import * as pdfjsLib from './pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;

const $ = id => document.getElementById(id);
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const PAGINAS_ESPERADAS = 534;

/* ---------- dados ---------- */
const HINOS = HINOS_DADOS.map(([n, t, p, y]) => ({ n, t, p, y, k: norm(t) }));
HINOS.forEach((h, i) => {
  const nx = HINOS[i + 1];
  h.fim = !nx ? PAGINA_FINAL_HINOS : (nx[2] === h.p || nx.y > 0 ? nx.p : nx.p - 1);
});
const porNumero = n => HINOS[n - 1];

/* ---------- armazenamento local ---------- */
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch (e) { return d } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} };
let favs = lsGet('hinario:fav', []), recs = lsGet('hinario:rec', []), zoom = lsGet('hinario:zoom', 1);

const DB = () => new Promise((ok, err) => {
  const r = indexedDB.open('hinario', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
  r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
});
const idb = async (modo, fn) => { const db = await DB(); return new Promise((ok, err) => { const tx = db.transaction('arquivos', modo); const req = fn(tx.objectStore('arquivos')); tx.oncomplete = () => ok(req && req.result); tx.onerror = () => err(tx.error); }) };

/* ---------- PDF ---------- */
let pdfDoc = null;
class BlobRange extends pdfjsLib.PDFDataRangeTransport {
  constructor(blob) { super(blob.size, null); this.blob = blob }
  requestDataRange(b, e) { this.blob.slice(b, e).arrayBuffer().then(buf => this.onDataRange(b, new Uint8Array(buf))) }
}
async function abrirPdf(blob) {
  let task = pdfjsLib.getDocument({ range: new BlobRange(blob), length: blob.size, disableAutoFetch: true, disableStream: true });
  try { return await task.promise }
  catch (e) {
    if (blob.size > 400e6) throw e;
    task = pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    return await task.promise;
  }
}
function mostrarEstadoPdf(info) {
  const tem = !!pdfDoc;
  $('pdfTitle').textContent = tem ? 'Hinário carregado ✓' : 'Carregue o seu hinário';
  $('pdfMsg').textContent = tem
    ? `${info?.nome || 'PDF'} · ${pdfDoc.numPages} páginas. Guardado neste aparelho, funciona sem internet.` + (pdfDoc.numPages !== PAGINAS_ESPERADAS ? ` Atenção: o índice foi feito para um PDF de ${PAGINAS_ESPERADAS} páginas; se os hinos abrirem na página errada, use o arquivo original.` : '')
    : 'Por respeito aos direitos autorais, este aplicativo não traz o hinário. Escolha o seu PDF uma única vez: ele fica guardado só neste aparelho e depois funciona sem internet.';
  $('pdfPickText').textContent = tem ? 'Trocar o PDF' : 'Escolher o PDF do hinário';
  $('pdfPick').classList.toggle('ghost', tem);
  $('pdfRemove').hidden = !tem;
}
async function carregarSalvo() {
  try {
    const reg = await idb('readonly', s => s.get('pdf'));
    if (reg?.blob) { pdfDoc = await abrirPdf(reg.blob); mostrarEstadoPdf(reg) } else mostrarEstadoPdf();
  } catch (e) { pdfDoc = null; mostrarEstadoPdf(); $('pdfMsg').textContent = 'Não foi possível abrir o PDF guardado. Escolha o arquivo de novo.' }
}
$('pdfFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  const prog = $('pdfProg'); prog.hidden = false; prog.removeAttribute('value');
  $('pdfMsg').textContent = 'Guardando o hinário neste aparelho… isso pode levar um minuto.';
  try {
    const novo = await abrirPdf(f);
    await idb('readwrite', s => s.put({ blob: f, nome: f.name, tamanho: f.size, em: Date.now() }, 'pdf'));
    pdfDoc = novo; mostrarEstadoPdf({ nome: f.name });
    navigator.storage?.persist?.();
  } catch (err) { $('pdfMsg').textContent = 'Este arquivo não parece ser um PDF válido. Tente de novo.' }
  prog.hidden = true; e.target.value = '';
});
$('pdfRemove').addEventListener('click', async e => {
  e.preventDefault();
  if (!confirm('Remover o PDF guardado neste aparelho? Você poderá carregá-lo de novo depois.')) return;
  await idb('readwrite', s => s.delete('pdf')); pdfDoc = null; mostrarEstadoPdf();
});

/* ---------- tela inicial ---------- */
function chip(n) { const h = porNumero(n); const b = document.createElement('button'); b.className = 'chip'; b.innerHTML = '<b></b> '; b.firstChild.textContent = n; b.append(h.t.length > 22 ? h.t.slice(0, 21) + '…' : h.t); b.onclick = () => abrirHino(n); return b }
function listas() {
  for (const [id, card, arr] of [['favList', 'favCard', favs], ['recList', 'recCard', recs]]) {
    const el = $(id); el.replaceChildren(...arr.map(chip)); $(card).hidden = !arr.length;
  }
}
function atualizar() {
  const q = $('num').value.trim(), pv = $('preview'), ul = $('results'); ul.replaceChildren(); pv.textContent = '';
  if (!q) return;
  if (/^\d+$/.test(q)) {
    const n = +q;
    pv.textContent = n >= 1 && n <= 480 ? `Hino ${n} – ${porNumero(n).t}` : 'Digite um número de 1 a 480.';
    return;
  }
  const k = norm(q), achados = HINOS.filter(h => h.k.includes(k)).slice(0, 40);
  pv.textContent = achados.length ? `${achados.length}${achados.length === 40 ? '+' : ''} hino(s) encontrado(s)` : 'Nenhum hino com esse nome.';
  achados.forEach(h => { const li = document.createElement('li'), b = document.createElement('button'), n = document.createElement('span'); n.className = 'n'; n.textContent = h.n; b.append(n, h.t); b.onclick = () => abrirHino(h.n); li.append(b); ul.append(li) });
}
$('num').addEventListener('input', atualizar);
function ir() {
  const q = $('num').value.trim();
  if (/^\d+$/.test(q) && +q >= 1 && +q <= 480) return abrirHino(+q);
  const f = HINOS.filter(h => h.k.includes(norm(q)));
  if (q && f.length === 1) abrirHino(f[0].n);
}
$('go').addEventListener('click', ir);
$('num').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ir() } });
$('openIndex').addEventListener('click', () => abrirVisor({ titulo: 'Índice', nome: 'alfabético', de: PAGINA_INDICE, ate: pdfDoc ? pdfDoc.numPages : PAGINA_INDICE + 14, y: 0, n: 0 }));

/* ---------- visor ---------- */
let atual = null, token = 0;
const stage = $('stage'), pages = $('pages');
function abrirHino(n) {
  const h = porNumero(n);
  recs = [n, ...recs.filter(x => x !== n)].slice(0, 8); lsSet('hinario:rec', recs);
  abrirVisor({ n, titulo: String(n), nome: h.t, de: h.p, ate: h.fim, y: h.y });
}
function abrirVisor(v) {
  if (!pdfDoc) { $('pdfCard').scrollIntoView({ behavior: 'smooth' }); $('pdfMsg').textContent = 'Primeiro carregue o PDF do hinário (uma vez só). Depois é só digitar o número.'; return }
  atual = v; $('vNum').textContent = v.titulo; $('vName').textContent = v.nome;
  $('viewer').hidden = false; document.body.style.overflow = 'hidden';
  if (history.state?.v !== 1) history.pushState({ v: 1 }, '');
  $('vFav').hidden = !v.n; $('vPrev').disabled = $('vNext').disabled = !v.n;
  marcarFav(); renderizar(true);
}
function fecharVisor(voltar = true) {
  token++; $('viewer').hidden = true; document.body.style.overflow = ''; atual = null; pages.replaceChildren(); listas();
  if (voltar && history.state?.v === 1) history.back();
}
window.addEventListener('popstate', () => { if (!$('viewer').hidden) fecharVisor(false) });
$('vBack').addEventListener('click', () => fecharVisor());
function marcarFav() { const on = atual?.n && favs.includes(atual.n); $('vFav').textContent = on ? '★' : '☆'; $('vFav').setAttribute('aria-pressed', on) }
$('vFav').addEventListener('click', () => { if (!atual?.n) return; favs = favs.includes(atual.n) ? favs.filter(x => x !== atual.n) : [...favs, atual.n].sort((a, b) => a - b); lsSet('hinario:fav', favs); marcarFav() });
const vizinho = d => { if (atual?.n) { const n = atual.n + d; if (n >= 1 && n <= 480) abrirHino(n) } };
$('vPrev').addEventListener('click', () => vizinho(-1));
$('vNext').addEventListener('click', () => vizinho(1));
addEventListener('keydown', e => { if ($('viewer').hidden) return; if (e.key === 'ArrowRight') vizinho(1); else if (e.key === 'ArrowLeft') vizinho(-1); else if (e.key === 'Escape') fecharVisor(); else if (e.key === '+') mudarZoom(.25); else if (e.key === '-') mudarZoom(-.25) });

async function renderizar(inicial) {
  const meu = ++token, v = atual;
  const ancora = inicial ? null : { x: (stage.scrollLeft + stage.clientWidth / 2) / Math.max(1, stage.scrollWidth), y: (stage.scrollTop + stage.clientHeight / 2) / Math.max(1, stage.scrollHeight) };
  $('vMsg').hidden = true;
  const larg = stage.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 3), alvo = [];
  try {
    for (let p = v.de; p <= v.ate; p++) {
      const page = await pdfDoc.getPage(p); if (meu !== token) return;
      const vp1 = page.getViewport({ scale: 1 });
      const css = larg / vp1.width * zoom;
      let esc = css * dpr; const px = vp1.width * esc * vp1.height * esc, max = 14e6;
      if (px > max) esc *= Math.sqrt(max / px);
      const vp = page.getViewport({ scale: esc });
      const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      c.style.width = vp1.width * css + 'px'; c.style.height = vp1.height * css + 'px';
      await page.render({ canvas: c, canvasContext: c.getContext('2d'), viewport: vp }).promise; if (meu !== token) return;
      alvo.push(c);
      if (p === v.de) {
        pages.replaceChildren();
        if (v.y > 0) {
          const corte = Math.max(0, v.y - 0.03), h = vp1.height * css, w = document.createElement('div'), mais = document.createElement('button');
          w.className = 'pw'; w.style.height = h * (1 - corte) + 'px'; c.style.marginTop = -h * corte + 'px';
          mais.className = 'more'; mais.textContent = '↑ Mostrar o início da página';
          mais.onclick = () => { w.style.height = h + 'px'; c.style.marginTop = '0'; mais.remove() };
          w.append(c); pages.append(mais, w);
        } else pages.append(c);
        if (inicial) { stage.scrollLeft = 0; stage.scrollTop = 0 }
      } else pages.append(c);
    }
    if (ancora) { stage.scrollLeft = ancora.x * stage.scrollWidth - stage.clientWidth / 2; stage.scrollTop = ancora.y * stage.scrollHeight - stage.clientHeight / 2 }
  } catch (e) { if (meu === token) { const m = $('vMsg'); m.textContent = 'Não foi possível desenhar esta página. Tente de novo.'; m.hidden = false } }
}
function mudarZoom(d, abs) { zoom = Math.min(3, Math.max(1, abs ?? Math.round((zoom + d) * 100) / 100)); lsSet('hinario:zoom', zoom); if (atual) renderizar(false) }
$('zIn').addEventListener('click', () => mudarZoom(.25));
$('zOut').addEventListener('click', () => mudarZoom(-.25));
$('zFit').addEventListener('click', () => mudarZoom(0, 1));

/* pinça com dois dedos */
const toques = new Map(); let d0 = 0, r = 1;
const dist = () => { const [a, b] = [...toques.values()]; return Math.hypot(a.x - b.x, a.y - b.y) };
stage.addEventListener('pointerdown', e => { toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (toques.size === 2) { d0 = dist(); r = 1 } });
stage.addEventListener('pointermove', e => { if (!toques.has(e.pointerId)) return; toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (toques.size === 2 && d0) { r = Math.min(3 / zoom, Math.max(1 / zoom, dist() / d0)); pages.style.transform = `scale(${r})` } });
const fimToque = e => { const tinha2 = toques.size === 2; toques.delete(e.pointerId); if (tinha2 && toques.size < 2 && d0) { d0 = 0; pages.style.transform = ''; if (Math.abs(r - 1) > .03) mudarZoom(0, Math.round(zoom * r * 20) / 20) } };
stage.addEventListener('pointerup', fimToque); stage.addEventListener('pointercancel', fimToque);
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (atual && !$('viewer').hidden) renderizar(false) }, 250) });

/* ---------- início ---------- */
listas(); carregarSalvo();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
