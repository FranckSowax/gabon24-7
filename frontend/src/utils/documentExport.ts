/**
 * Export de documents projet (business plan, rapport exécutif, etc.)
 * vers .doc (Word) et .pdf (impression navigateur), avec rendu Markdown.
 * Utilisé par la modale document de "Mes projets" et par DocumentViewer.
 */

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineMd(s: string) {
  let out = escapeHtml(s)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
  return out
}

/** Convertit du Markdown en HTML (titres, gras/italique, listes, tableaux, citations). */
export function mdToHtml(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let i = 0
  let listType: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null }
  }
  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (/^\|.*\|$/.test(trimmed) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      closeList()
      const header = trimmed.slice(1, -1).split('|').map((c) => c.trim())
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()))
        i++
      }
      html.push('<table><thead><tr>' + header.map((h) => `<th>${inlineMd(h)}</th>`).join('') + '</tr></thead><tbody>')
      rows.forEach((r) => html.push('<tr>' + r.map((c) => `<td>${inlineMd(c)}</td>`).join('') + '</tr>'))
      html.push('</tbody></table>')
      continue
    }

    if (trimmed === '') { closeList(); i++; continue }
    if (/^---+$/.test(trimmed) || /^___+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) { closeList(); html.push('<hr/>'); i++; continue }

    const h = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (h) { closeList(); const lvl = h[1].length; html.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`); i++; continue }

    if (/^>\s?/.test(trimmed)) { closeList(); html.push(`<blockquote>${inlineMd(trimmed.replace(/^>\s?/, ''))}</blockquote>`); i++; continue }

    const ul = trimmed.match(/^[-*+]\s+(.*)$/)
    if (ul) { if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul' } html.push(`<li>${inlineMd(ul[1])}</li>`); i++; continue }

    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/)
    if (ol) { if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol' } html.push(`<li>${inlineMd(ol[1])}</li>`); i++; continue }

    closeList()
    html.push(`<p>${inlineMd(trimmed)}</p>`)
    i++
  }
  closeList()
  return html.join('\n')
}

const PRINT_CSS = `
  body { font-family: 'Calibri','Arial',sans-serif; line-height: 1.6; color: #1f2937; max-width: 820px; margin: 40px auto; padding: 20px; }
  h1,h2,h3,h4,h5,h6 { color: #15803d; margin-top: 22px; margin-bottom: 10px; }
  h1 { font-size: 26px; border-bottom: 2px solid #15803d; padding-bottom: 8px; }
  h2 { font-size: 21px; } h3 { font-size: 18px; }
  p { margin: 10px 0; } ul,ol { margin: 10px 0; padding-left: 28px; } li { margin: 4px 0; }
  strong { color: #166534; } em { color: #4b5563; }
  code { background:#f3f4f6; padding:2px 6px; border-radius:4px; font-family:'Courier New',monospace; }
  blockquote { border-left: 4px solid #15803d; padding-left: 14px; margin: 14px 0; color:#4b5563; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; }
  th,td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background:#f0fdf4; font-weight: bold; color:#166534; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }
  .doc-header { text-align:center; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
  .doc-meta { color:#6b7280; font-size: 13px; margin-top: 6px; }
  @media print { body { margin: 0; padding: 18px; } }
`

/** Construit un document HTML complet et autonome à partir du contenu Markdown. */
export function buildDocumentHtml(title: string, content: string, createdAt?: string): string {
  const dateStr = new Date(createdAt || Date.now()).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body><div class="doc-header"><h1>${escapeHtml(title)}</h1><div class="doc-meta">Généré le ${dateStr}</div></div>${mdToHtml(content)}</body></html>`
}

/** Télécharge le document au format Word (.doc). */
export function exportDocumentAsWord(title: string, content: string, createdAt?: string) {
  const safeTitle = title || 'document'
  const html = buildDocumentHtml(safeTitle, content, createdAt)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeTitle.replace(/[^a-z0-9]/gi, '_')}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Ouvre la boîte d'impression (→ « Enregistrer au format PDF »). */
export function exportDocumentAsPdf(title: string, content: string, createdAt?: string) {
  const html = buildDocumentHtml(title || 'document', content, createdAt)
  const w = window.open('', '_blank')
  if (!w) { alert('Veuillez autoriser les pop-ups pour exporter en PDF.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}
