/**
 * bcegPdfService — Génération PDF dossier de financement BCEG
 *
 * Produit un PDF A4 multi-pages : couverture, pitch, business plan,
 * simulation de crédit, plan d'action, KPIs.
 *
 * Usage:
 *   const buffer = await generateBcegDossier({ submission, project, simulation, score });
 *   // → Buffer Node, à streamer en réponse HTTP ou pièce jointe email
 */

const PDFDocument = require('pdfkit');

const COLORS = {
  primary: '#f59e0b',   // ambre BCEG
  dark: '#0f172a',
  text: '#1e293b',
  muted: '#64748b',
  border: '#cbd5e1',
  accent: '#10b981',
  warn: '#ef4444',
};

function fmtXaf(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XAF';
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function safeText(s, fallback = '—') {
  if (!s) return fallback;
  return String(s).trim();
}

/**
 * Génère le PDF en mémoire et retourne un Buffer.
 * @returns Promise<Buffer>
 */
async function generateBcegDossier({ submission, project, simulation, score, userInfo }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        info: {
          Title: `Dossier BCEG — ${safeText(project?.proposition_titre, 'Projet')}`,
          Author: 'Gabon Insight',
          Subject: 'Demande de financement BCEG',
          Keywords: 'BCEG, financement, Gabon, entrepreneuriat',
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      drawCoverPage(doc, { submission, project, score });
      doc.addPage();
      drawProjectSection(doc, { project });
      drawSimulationSection(doc, { simulation, submission });
      doc.addPage();
      drawActionPlanSection(doc, { project });
      drawFooter(doc, { submission, userInfo });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// =====================================================================
// PAGES
// =====================================================================

function drawCoverPage(doc, { submission, project, score }) {
  const W = doc.page.width;
  const M = doc.page.margins.left;

  doc.rect(0, 0, W, 8).fill(COLORS.primary);

  doc.fillColor(COLORS.dark)
    .font('Helvetica-Bold').fontSize(28)
    .text('Dossier de financement', M, 80);
  doc.fillColor(COLORS.primary)
    .font('Helvetica-Bold').fontSize(36)
    .text('BCEG Project', M, 115);

  doc.fillColor(COLORS.muted)
    .font('Helvetica').fontSize(11)
    .text("Banque pour le Commerce et l'Entrepreneuriat du Gabon", M, 165);

  const boxY = 220;
  doc.roundedRect(M, boxY, W - 2 * M, 220, 10).fillAndStroke('#fef3c7', COLORS.primary);

  doc.fillColor(COLORS.dark)
    .font('Helvetica-Bold').fontSize(18)
    .text(safeText(project?.proposition_titre, 'Projet sans titre'), M + 20, boxY + 25, { width: W - 2 * M - 40 });

  doc.fillColor(COLORS.muted)
    .font('Helvetica').fontSize(10)
    .text(`Secteur : ${safeText(project?.secteur_selectionne, 'Non précisé')}`, M + 20, boxY + 70);

  const kvY = boxY + 100;
  drawKv(doc, M + 20, kvY, 'Montant demandé', fmtXaf(submission?.montant_demande));
  drawKv(doc, M + 200, kvY, 'BCEG Score', score?.score !== undefined && score?.score !== null ? `${score.score}/100` : '—');
  drawKv(doc, M + 360, kvY, 'Réf. BCEG', safeText(submission?.bceg_reference, 'En attente'));

  const statusColors = {
    draft: { bg: '#e2e8f0', fg: '#475569', label: 'Brouillon' },
    submitted: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Soumis' },
    in_review: { bg: '#fef3c7', fg: '#a16207', label: 'En revue' },
    accepted: { bg: '#d1fae5', fg: '#047857', label: 'Accepté' },
    rejected: { bg: '#fee2e2', fg: '#b91c1c', label: 'Rejeté' },
  };
  const st = statusColors[submission?.status] || statusColors.submitted;
  doc.roundedRect(M + 20, boxY + 175, 95, 22, 11).fill(st.bg);
  doc.fillColor(st.fg).font('Helvetica-Bold').fontSize(9.5).text(st.label, M + 20, boxY + 181, { width: 95, align: 'center' });

  doc.fillColor(COLORS.muted)
    .font('Helvetica').fontSize(9)
    .text(`Dossier généré le ${fmtDate(new Date())} par Gabon Insight`, M, doc.page.height - 80);
  doc.text(`Ce document a été produit automatiquement à partir des données du projet sur la plateforme Gabon Insight.`, M, doc.page.height - 65, { width: W - 2 * M });
}

function drawProjectSection(doc, { project }) {
  drawSectionTitle(doc, 'PRÉSENTATION DU PROJET');

  if (project?.problematique_centrale) {
    drawSubsection(doc, 'Problématique adressée');
    drawParagraph(doc, project.problematique_centrale);
  }

  if (project?.proposition_description) {
    drawSubsection(doc, 'Description de la solution');
    drawParagraph(doc, project.proposition_description);
  }

  if (project?.acteurs_impactes) {
    drawSubsection(doc, 'Acteurs impactés');
    drawParagraph(doc, project.acteurs_impactes);
  }

  drawSubsection(doc, 'Indicateurs clés');
  const indicators = [
    ['Investissement estimé', project?.proposition_investissement],
    ['Rentabilité projetée', project?.proposition_rentabilite],
    ['Revenus mensuels estimés', project?.proposition_revenus_mensuels],
    ["Score de faisabilité (IA)", project?.proposition_score_faisabilite ? `${project.proposition_score_faisabilite}/100` : null],
    ['Urgence (1-10)', project?.urgence_score],
  ].filter(([_, v]) => v !== null && v !== undefined && v !== '');

  indicators.forEach(([label, value]) => {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(`${label} : `, { continued: true });
    doc.fillColor(COLORS.text).font('Helvetica-Bold').text(safeText(String(value)));
  });
  doc.moveDown(0.5);
}

function drawSimulationSection(doc, { simulation, submission }) {
  doc.moveDown(1);
  drawSectionTitle(doc, 'SIMULATION DE CRÉDIT BCEG');

  const W = doc.page.width;
  const M = doc.page.margins.left;

  const recapY = doc.y;
  doc.roundedRect(M, recapY, W - 2 * M, 90, 8).fillAndStroke('#f8fafc', COLORS.border);

  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(11)
    .text('Mensualité estimée', M + 15, recapY + 12);
  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(20)
    .text(fmtXaf(simulation?.mensualite), M + 15, recapY + 30);

  const right = M + 250;
  drawKvSmall(doc, right, recapY + 12, 'Type', simulation?.type === 'entreprise' ? 'Entreprise' : 'Particulier');
  drawKvSmall(doc, right, recapY + 32, 'Durée', simulation?.duree_mois ? `${simulation.duree_mois} mois` : '—');
  drawKvSmall(doc, right, recapY + 52, 'Taux annuel', simulation?.taux_annuel ? `${simulation.taux_annuel} %` : '—');

  doc.y = recapY + 110;

  drawSubsection(doc, 'Détail de la simulation');
  const items = [
    ['Montant demandé', fmtXaf(simulation?.montant_demande || submission?.montant_demande)],
    ['Apport personnel', `${fmtXaf(simulation?.apport_personnel)} (${simulation?.apport_pct ?? 0} %)`],
    ['Capital emprunté (après apport)', fmtXaf((simulation?.montant_demande || 0) - (simulation?.apport_personnel || 0))],
    ['Durée du prêt', simulation?.duree_mois ? `${simulation.duree_mois} mois (${(simulation.duree_mois / 12).toFixed(1)} ans)` : '—'],
    ['Taux annuel (subventionné BCEG)', simulation?.taux_annuel ? `${simulation.taux_annuel} %` : '—'],
    ['Mensualité', fmtXaf(simulation?.mensualite)],
    ['Coût total du crédit', fmtXaf(simulation?.cout_credit)],
    ['Total à rembourser', fmtXaf(simulation?.total_a_rembourser)],
  ];
  items.forEach(([k, v]) => {
    const y = doc.y;
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.5).text(k, M, y);
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9.5).text(v, M + 250, y);
    doc.moveDown(0.4);
  });

  if (simulation?.capacite_remboursement_ok !== null && simulation?.capacite_remboursement_ok !== undefined) {
    doc.moveDown(0.5);
    const ok = simulation.capacite_remboursement_ok;
    doc.fillColor(ok ? COLORS.accent : COLORS.warn)
      .font('Helvetica-Bold').fontSize(10)
      .text(ok ? '✓ Capacité de remboursement validée (mensualité < 33 % du revenu)'
               : '⚠ Capacité de remboursement à renforcer (mensualité > 33 % du revenu)');
  }
}

function drawActionPlanSection(doc, { project }) {
  drawSectionTitle(doc, "PLAN D'ACTION & ANALYSE");

  if (project?.proposition_actions_immediates) {
    drawSubsection(doc, 'Actions immédiates prévues');
    const actions = Array.isArray(project.proposition_actions_immediates)
      ? project.proposition_actions_immediates
      : (typeof project.proposition_actions_immediates === 'string'
          ? [project.proposition_actions_immediates]
          : []);
    actions.forEach((a, i) => {
      doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(10)
        .text(`${i + 1}.`, { continued: true, indent: 0 });
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
        .text(' ' + safeText(typeof a === 'string' ? a : (a.titre || a.action || '')));
      doc.moveDown(0.2);
    });
  }

  if (project?.proposition_avantages_concurrentiels) {
    drawSubsection(doc, 'Avantages concurrentiels');
    const advs = Array.isArray(project.proposition_avantages_concurrentiels)
      ? project.proposition_avantages_concurrentiels
      : [];
    advs.forEach(a => {
      doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(10).text('•', { continued: true, indent: 0 });
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(' ' + safeText(typeof a === 'string' ? a : (a.titre || '')));
      doc.moveDown(0.2);
    });
  }
}

// =====================================================================
// HELPERS RENDU
// =====================================================================

function drawSectionTitle(doc, title) {
  const M = doc.page.margins.left;
  doc.moveDown(1);
  doc.fillColor(COLORS.primary).rect(M, doc.y, 4, 18).fill();
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(14).text('  ' + title, M, doc.y - 16);
  doc.moveDown(0.8);
}

function drawSubsection(doc, title) {
  doc.moveDown(0.6);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(11).text(title);
  doc.fillColor(COLORS.border).rect(doc.page.margins.left, doc.y + 1, 40, 1).fill();
  doc.moveDown(0.4);
  doc.fillColor(COLORS.text);
}

function drawParagraph(doc, text) {
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(safeText(text), { align: 'justify' });
}

function drawKv(doc, x, y, label, value) {
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(label.toUpperCase(), x, y);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(13).text(value, x, y + 12, { width: 150 });
}

function drawKvSmall(doc, x, y, label, value) {
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(label, x, y);
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10).text(value, x + 70, y);
}

function drawFooter(doc, { submission, userInfo }) {
  const W = doc.page.width;
  const H = doc.page.height;
  const M = doc.page.margins.left;
  const y = H - 50;
  doc.fillColor(COLORS.border).rect(M, y - 8, W - 2 * M, 0.5).fill();
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
    .text(`Dossier ID : ${submission?.id || '—'}  •  ${userInfo?.email || 'gabon-insight.com'}  •  ${fmtDate(submission?.created_at)}`, M, y);
}

module.exports = { generateBcegDossier };
