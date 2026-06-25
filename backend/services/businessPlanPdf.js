/**
 * Génère un PDF "Business Plan / Plan d'action" au template BCEG à partir des
 * sections numérotées générées par l'IA (table project_documents).
 *
 * - Regroupement déterministe (aucun appel IA) : fidèle au contenu généré.
 * - Rendu HTML stylé aux couleurs BCEG → PDF via Puppeteer (Chromium système).
 */

const puppeteer = require('puppeteer');

const BCEG_GREEN = '#697357';
const BCEG_DARK = '#4d553e';

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(s) {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

/** Markdown → HTML (titres, gras/italique, listes, tableaux, citations). */
function mdToHtml(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let listType = null;
  const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = null; } };
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (/^\|.*\|$/.test(trimmed) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      closeList();
      const header = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      html.push('<table><thead><tr>' + header.map((h) => `<th>${inlineMd(h)}</th>`).join('') + '</tr></thead><tbody>');
      rows.forEach((r) => html.push('<tr>' + r.map((c) => `<td>${inlineMd(c)}</td>`).join('') + '</tr>'));
      html.push('</tbody></table>');
      continue;
    }
    if (trimmed === '') { closeList(); i++; continue; }
    if (/^---+$/.test(trimmed) || /^___+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) { closeList(); html.push('<hr/>'); i++; continue; }
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); const lvl = Math.min(6, h[1].length); html.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`); i++; continue; }
    if (/^>\s?/.test(trimmed)) { closeList(); html.push(`<blockquote>${inlineMd(trimmed.replace(/^>\s?/, ''))}</blockquote>`); i++; continue; }
    const ul = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ul) { if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; } html.push(`<li>${inlineMd(ul[1])}</li>`); i++; continue; }
    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ol) { if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; } html.push(`<li>${inlineMd(ol[1])}</li>`); i++; continue; }
    closeList();
    html.push(`<p>${inlineMd(trimmed)}</p>`);
    i++;
  }
  closeList();
  return html.join('\n');
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Calibri','Segoe UI','Arial',sans-serif; line-height: 1.6; color: #1f2937; margin: 0; }
  h1,h2,h3,h4 { color: ${BCEG_DARK}; margin: 18px 0 10px; }
  h2 { font-size: 20px; border-bottom: 2px solid ${BCEG_GREEN}; padding-bottom: 6px; }
  h3 { font-size: 16px; } h4 { font-size: 14px; }
  p { margin: 9px 0; } ul,ol { margin: 9px 0; padding-left: 26px; } li { margin: 3px 0; }
  strong { color: ${BCEG_DARK}; } em { color: #4b5563; }
  code { background:#f3f4f6; padding:2px 6px; border-radius:4px; font-family:'Courier New',monospace; font-size: 12px; }
  blockquote { border-left: 4px solid ${BCEG_GREEN}; padding-left: 14px; margin: 12px 0; color:#4b5563; font-style: italic; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 12px; }
  th,td { border: 1px solid #d1d5db; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background:#f0efe9; font-weight: bold; color:${BCEG_DARK}; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  .cover { height: 247mm; display: flex; flex-direction: column; justify-content: center;
           background: linear-gradient(135deg, ${BCEG_GREEN} 0%, ${BCEG_DARK} 100%); color:#fff;
           padding: 40px; page-break-after: always; }
  .cover .kicker { text-transform: uppercase; letter-spacing: 3px; font-size: 13px; opacity: .85; }
  .cover h1 { color:#fff; font-size: 38px; line-height: 1.2; margin: 18px 0; border: none; }
  .cover .meta { margin-top: 28px; font-size: 14px; opacity: .92; }
  .cover .meta div { margin: 4px 0; }
  .cover .badge { display:inline-block; margin-top: 26px; padding: 8px 16px; border:1px solid rgba(255,255,255,.4);
                  border-radius: 999px; font-size: 12px; letter-spacing: 1px; }
  .toc { page-break-after: always; }
  .toc h2 { border:none; }
  .toc ol { font-size: 14px; } .toc li { margin: 7px 0; }
  .section { page-break-before: always; }
  .annexes { page-break-before: always; }
  .annexe-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border:1px solid #e5e7eb;
                 border-radius:8px; margin:7px 0; font-size: 14px; }
  .annexe-ok { color:#15803d; font-weight:bold; } .annexe-no { color:#b45309; }
`;

/**
 * Construit le HTML complet du document.
 * @param {object} o
 * @param {string} o.docTitle   - Titre (ex: "Business Plan")
 * @param {string} o.projectTitle
 * @param {string} [o.owner]
 * @param {string} [o.dateStr]
 * @param {Array<{number?:number,title:string,content:string}>} o.sections
 * @param {Array<{label:string,present:boolean}>} [o.annexes]
 */
function buildBcegBusinessPlanHtml(o) {
  const dateStr = o.dateStr || new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  const sections = o.sections || [];
  const annexes = o.annexes || [];

  const toc = sections.map((s, idx) =>
    `<li>${escapeHtml(s.title || `Section ${s.number || idx + 1}`)}</li>`
  ).join('');

  const body = sections.map((s, idx) => {
    const num = s.number || idx + 1;
    return `<div class="section"><h2>${num}. ${escapeHtml(s.title || `Section ${num}`)}</h2>${mdToHtml(s.content)}</div>`;
  }).join('');

  const annexesHtml = annexes.length ? `
    <div class="annexes">
      <h2>Annexes — Pièces du dossier</h2>
      <p>Les pièces justificatives suivantes sont jointes séparément au dossier de financement BCEG :</p>
      ${annexes.map(a => `
        <div class="annexe-item">
          <span class="${a.present ? 'annexe-ok' : 'annexe-no'}">${a.present ? '✔' : '✗'}</span>
          <span>${escapeHtml(a.label)} ${a.present ? '— fournie' : '— à fournir'}</span>
        </div>`).join('')}
    </div>` : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
    <title>${escapeHtml(o.docTitle)} — ${escapeHtml(o.projectTitle)}</title>
    <style>${CSS}</style></head><body>
    <div class="cover">
      <div class="kicker">Dossier de financement</div>
      <h1>${escapeHtml(o.docTitle)}</h1>
      <div class="meta">
        <div><strong>Projet :</strong> ${escapeHtml(o.projectTitle || '—')}</div>
        ${o.owner ? `<div><strong>Porteur :</strong> ${escapeHtml(o.owner)}</div>` : ''}
        <div><strong>Date :</strong> ${escapeHtml(dateStr)}</div>
      </div>
      <div class="badge">BCEG — Banque pour le Commerce et l'Entreprise du Gabon</div>
    </div>
    <div class="toc">
      <h2>Sommaire</h2>
      <ol>${toc}</ol>
    </div>
    ${body}
    ${annexesHtml}
  </body></html>`;
}

/** Rend un HTML en PDF (Buffer) via Chromium système. */
async function renderHtmlToPdf(html) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' },
    });
    return pdf;
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { mdToHtml, buildBcegBusinessPlanHtml, renderHtmlToPdf };
