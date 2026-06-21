'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Printer, FileText, Calendar, Pencil, Save, FileType2, FileDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface DocumentLike {
  id: string
  title: string
  content: string
  document_type: string
  created_at: string
  project_id?: string
  metadata?: any
}

interface DocumentViewerProps {
  isOpen: boolean
  onClose: () => void
  document: DocumentLike | null
  /** Appelé après une sauvegarde réussie avec le document mis à jour (pour rafraîchir la liste parente). */
  onSaved?: (updated: DocumentLike) => void
}

// ───────────────────────── Markdown → HTML (autonome, pour export/impression) ─────────────────────────
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
function mdToHtml(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let i = 0
  let listType: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null }
  }
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Tableau (bloc | ... |)
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

function buildFullHtml(title: string, contentHtml: string, createdAt: string) {
  const dateStr = new Date(createdAt || Date.now()).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body><div class="doc-header"><h1>${escapeHtml(title)}</h1><div class="doc-meta">Généré le ${dateStr}</div></div>${contentHtml}</body></html>`
}

export default function DocumentViewer({ isOpen, onClose, document, onSaved }: DocumentViewerProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  // (Ré)initialise l'état quand on ouvre un autre document
  useEffect(() => {
    if (document) {
      setContent(document.content || '')
      setTitle(document.title || '')
      setEditing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id])

  const startEdit = () => { setDraftContent(content); setDraftTitle(title); setEditing(true) }
  const cancelEdit = () => setEditing(false)

  const handleSave = useCallback(async () => {
    if (!document) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/project-documents/${document.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftContent, title: draftTitle }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`)
      setContent(draftContent)
      setTitle(draftTitle)
      setEditing(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      onSaved?.(data.document || { ...document, content: draftContent, title: draftTitle })
    } catch (e: any) {
      alert("Échec de l'enregistrement : " + (e?.message || 'erreur inconnue'))
    } finally {
      setSaving(false)
    }
  }, [document, draftContent, draftTitle, onSaved])

  const exportPdf = () => {
    const html = buildFullHtml(title, mdToHtml(content), document?.created_at || '')
    const w = window.open('', '_blank')
    if (!w) { alert('Veuillez autoriser les pop-ups pour exporter en PDF.'); return }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  const exportDoc = () => {
    const html = buildFullHtml(title, mdToHtml(content), document?.created_at || '')
    // Word ouvre parfaitement du HTML déclaré en application/msword.
    const blob = new Blob(['﻿', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${(title || 'document').replace(/[^a-z0-9]/gi, '_')}.doc`
    window.document.body.appendChild(a)
    a.click()
    window.document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (!isOpen || !document) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-emerald-500/20"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-r from-emerald-600/10 to-teal-600/10">
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-6 h-6 text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">
                    {document.metadata?.document_type || document.document_type}
                  </span>
                  {savedFlash && <span className="text-xs text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full">✓ Enregistré</span>}
                </div>
                {editing ? (
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full text-2xl font-bold text-white bg-slate-800/70 border border-emerald-500/30 rounded-lg px-3 py-1.5 mb-2 focus:outline-none focus:border-emerald-400"
                    placeholder="Titre du document"
                  />
                ) : (
                  <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(document.created_at)}</span>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mt-4">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEdit}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Éditer
                  </button>
                  <button
                    onClick={exportPdf}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    <FileDown className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={exportDoc}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    <FileType2 className="w-4 h-4" /> Word (.doc)
                  </button>
                  <button
                    onClick={exportPdf}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                    title="Imprimer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-white/5">
            {editing ? (
              <div className="flex flex-col h-full">
                <p className="text-xs text-gray-400 mb-2">
                  ✏️ Édition en Markdown — titres <code className="text-emerald-300">#</code>, gras <code className="text-emerald-300">**texte**</code>, listes <code className="text-emerald-300">- item</code>.
                </p>
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="w-full min-h-[50vh] flex-1 bg-slate-900/80 text-gray-100 border border-emerald-500/20 rounded-xl p-4 font-mono text-sm leading-relaxed focus:outline-none focus:border-emerald-400 resize-y"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="prose prose-invert prose-emerald max-w-none">
                <ReactMarkdown
                  components={{
                    h1: (props: any) => <h1 className="text-3xl font-bold text-emerald-400 mb-4 pb-2 border-b border-emerald-500/30" {...props} />,
                    h2: (props: any) => <h2 className="text-2xl font-bold text-emerald-300 mt-6 mb-3" {...props} />,
                    h3: (props: any) => <h3 className="text-xl font-semibold text-white mt-4 mb-2" {...props} />,
                    p: (props: any) => <p className="text-gray-300 mb-4 leading-relaxed" {...props} />,
                    ul: (props: any) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1" {...props} />,
                    ol: (props: any) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1" {...props} />,
                    li: (props: any) => <li className="ml-4" {...props} />,
                    strong: (props: any) => <strong className="text-emerald-400 font-bold" {...props} />,
                    em: (props: any) => <em className="text-gray-400 italic" {...props} />,
                    code: (props: any) => <code className="bg-slate-800 px-2 py-1 rounded text-sm text-emerald-300" {...props} />,
                    pre: (props: any) => <pre className="bg-slate-800 p-4 rounded-lg overflow-x-auto mb-4" {...props} />,
                    blockquote: (props: any) => <blockquote className="border-l-4 border-emerald-500 pl-4 italic text-gray-400 my-4" {...props} />,
                    table: (props: any) => <table className="min-w-full border-collapse border border-gray-700 my-4" {...props} />,
                    th: (props: any) => <th className="border border-gray-700 px-4 py-2 bg-slate-800 text-emerald-400 font-semibold text-left" {...props} />,
                    td: (props: any) => <td className="border border-gray-700 px-4 py-2 text-gray-300" {...props} />,
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-900/50 flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {editing ? 'Mode édition' : 'Aperçu'} · {content.length.toLocaleString('fr-FR')} caractères
            </span>
            <button onClick={onClose} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors">
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
