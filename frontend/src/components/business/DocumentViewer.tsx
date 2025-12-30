'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Printer, Download, FileText, Calendar } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface DocumentViewerProps {
  isOpen: boolean
  onClose: () => void
  document: {
    id: string
    title: string
    content: string
    document_type: string
    created_at: string
    metadata?: any
  } | null
}

export default function DocumentViewer({ isOpen, onClose, document }: DocumentViewerProps) {
  if (!isOpen || !document) return null

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${document.title}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #2563eb;
              margin-top: 24px;
              margin-bottom: 12px;
            }
            h1 { font-size: 28px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
            h2 { font-size: 24px; }
            h3 { font-size: 20px; }
            p { margin: 12px 0; }
            ul, ol { margin: 12px 0; padding-left: 30px; }
            li { margin: 6px 0; }
            strong { color: #1e40af; }
            em { color: #6b7280; }
            code {
              background-color: #f3f4f6;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Courier New', monospace;
            }
            pre {
              background-color: #f3f4f6;
              padding: 16px;
              border-radius: 8px;
              overflow-x: auto;
            }
            blockquote {
              border-left: 4px solid #2563eb;
              padding-left: 16px;
              margin: 16px 0;
              color: #6b7280;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 16px 0;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
            }
            .document-header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #e5e7eb;
            }
            .document-meta {
              color: #6b7280;
              font-size: 14px;
              margin-top: 8px;
            }
            @media print {
              body { margin: 0; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="document-header">
            <h1>${document.title}</h1>
            <div class="document-meta">
              Généré le ${new Date(document.created_at).toLocaleDateString('fr-FR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
          ${document.content.replace(/\n/g, '<br>')}
        </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleDownload = () => {
    const blob = new Blob([document.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${document.title.replace(/[^a-z0-9]/gi, '_')}.md`
    if (window.document.body) {
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
    }
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-blue-500/20"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-6 h-6 text-blue-400" />
                  <span className="text-sm text-blue-400 font-medium">
                    {document.metadata?.document_type || document.document_type}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {document.title}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(document.created_at)}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimer
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-white/5">
            <div className="prose prose-invert prose-blue max-w-none">
              <ReactMarkdown
                components={{
                  h1: (props: any) => <h1 className="text-3xl font-bold text-blue-400 mb-4 pb-2 border-b border-blue-500/30" {...props} />,
                  h2: (props: any) => <h2 className="text-2xl font-bold text-blue-300 mt-6 mb-3" {...props} />,
                  h3: (props: any) => <h3 className="text-xl font-semibold text-white mt-4 mb-2" {...props} />,
                  p: (props: any) => <p className="text-gray-300 mb-4 leading-relaxed" {...props} />,
                  ul: (props: any) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1" {...props} />,
                  ol: (props: any) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1" {...props} />,
                  li: (props: any) => <li className="ml-4" {...props} />,
                  strong: (props: any) => <strong className="text-blue-400 font-bold" {...props} />,
                  em: (props: any) => <em className="text-gray-400 italic" {...props} />,
                  code: (props: any) => <code className="bg-slate-800 px-2 py-1 rounded text-sm text-blue-300" {...props} />,
                  pre: (props: any) => <pre className="bg-slate-800 p-4 rounded-lg overflow-x-auto mb-4" {...props} />,
                  blockquote: (props: any) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-400 my-4" {...props} />,
                  table: (props: any) => <table className="min-w-full border-collapse border border-gray-700 my-4" {...props} />,
                  th: (props: any) => <th className="border border-gray-700 px-4 py-2 bg-slate-800 text-blue-400 font-semibold text-left" {...props} />,
                  td: (props: any) => <td className="border border-gray-700 px-4 py-2 text-gray-300" {...props} />
                }}
              >
                {document.content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-900/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
