const sgMail = require('@sendgrid/mail');

// Configuration SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️ SENDGRID_API_KEY non configurée - Emails désactivés');
}

// Template HTML de base
const getEmailTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 40px 30px;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .button-secondary {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .info-box {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .project-info {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .project-info h3 {
      margin-top: 0;
      color: #059669;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p><strong>Gabon Insight</strong></p>
      <p>Plateforme de gestion de projets collaboratifs</p>
      <p style="margin-top: 20px; font-size: 12px;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
      </p>
    </div>
  </div>
</body>
</html>
`;

// Email d'invitation collaborateur
async function sendCollaboratorInvitation({ 
  collaboratorEmail, 
  ownerName, 
  projectTitle, 
  projectDescription,
  invitationId,
  acceptUrl,
  rejectUrl 
}) {
  const content = `
    <div class="header">
      <h1>🤝 Invitation à Collaborer</h1>
    </div>
    <div class="content">
      <p>Bonjour,</p>
      
      <p><strong>${ownerName}</strong> vous invite à collaborer sur un projet sur Gabon Insight.</p>
      
      <div class="project-info">
        <h3>📊 ${projectTitle}</h3>
        ${projectDescription ? `<p>${projectDescription}</p>` : ''}
      </div>
      
      <div class="info-box">
        <p><strong>En tant que collaborateur, vous pourrez :</strong></p>
        <ul>
          <li>✅ Visualiser le projet et son avancement</li>
          <li>💬 Ajouter des commentaires et suggestions</li>
          <li>📄 Partager des documents</li>
          <li>🤖 Vos contributions enrichiront le contexte IA</li>
        </ul>
      </div>
      
      <p style="text-align: center; margin: 30px 0;">
        <a href="${acceptUrl}" class="button">✓ Accepter l'invitation</a>
        <br>
        <a href="${rejectUrl}" class="button button-secondary">✗ Refuser</a>
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">
        💡 Cette invitation est personnelle et ne peut pas être transférée.
      </p>
    </div>
  `;

  const msg = {
    to: collaboratorEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
    subject: `🤝 ${ownerName} vous invite à collaborer sur "${projectTitle}"`,
    html: getEmailTemplate(content)
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email invitation envoyé via SendGrid');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur envoi email invitation:', error);
    return { success: false, error: error.message };
  }
}

// Email nouveau commentaire
async function sendCommentNotification({
  recipientEmail,
  recipientName,
  commenterName,
  projectTitle,
  commentContent,
  projectUrl
}) {
  const content = `
    <div class="header">
      <h1>💬 Nouveau Commentaire</h1>
    </div>
    <div class="content">
      <p>Bonjour ${recipientName || ''},</p>
      
      <p><strong>${commenterName}</strong> a ajouté un commentaire sur le projet <strong>${projectTitle}</strong>.</p>
      
      <div class="info-box">
        <p><strong>Commentaire :</strong></p>
        <p style="font-style: italic;">"${commentContent}"</p>
      </div>
      
      <p style="text-align: center;">
        <a href="${projectUrl}" class="button">Voir le projet</a>
      </p>
    </div>
  `;

  const msg = {
    to: recipientEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
    subject: `💬 ${commenterName} a commenté "${projectTitle}"`,
    html: getEmailTemplate(content)
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email commentaire envoyé via SendGrid');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur envoi email commentaire:', error);
    return { success: false, error: error.message };
  }
}

// Email nouveau document
async function sendDocumentNotification({
  recipientEmail,
  recipientName,
  uploaderName,
  projectTitle,
  documentTitle,
  projectUrl
}) {
  const content = `
    <div class="header">
      <h1>📄 Nouveau Document</h1>
    </div>
    <div class="content">
      <p>Bonjour ${recipientName || ''},</p>
      
      <p><strong>${uploaderName}</strong> a ajouté un document au projet <strong>${projectTitle}</strong>.</p>
      
      <div class="project-info">
        <h3>📄 ${documentTitle}</h3>
        <p>Le document a été ajouté à la bibliothèque du projet et est maintenant disponible pour tous les collaborateurs.</p>
      </div>
      
      <p style="text-align: center;">
        <a href="${projectUrl}" class="button">Consulter le document</a>
      </p>
    </div>
  `;

  const msg = {
    to: recipientEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
    subject: `📄 ${uploaderName} a partagé "${documentTitle}"`,
    html: getEmailTemplate(content)
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email document envoyé via SendGrid');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur envoi email document:', error);
    return { success: false, error: error.message };
  }
}

// Email acceptation invitation (pour le propriétaire)
async function sendInvitationAcceptedNotification({
  ownerEmail,
  ownerName,
  collaboratorName,
  collaboratorEmail,
  projectTitle,
  projectUrl
}) {
  const content = `
    <div class="header">
      <h1>✅ Invitation Acceptée</h1>
    </div>
    <div class="content">
      <p>Bonjour ${ownerName || ''},</p>
      
      <p><strong>${collaboratorName || collaboratorEmail}</strong> a accepté votre invitation à collaborer sur <strong>${projectTitle}</strong> !</p>
      
      <div class="info-box">
        <p>🎉 Votre équipe s'agrandit ! Le nouveau collaborateur peut maintenant :</p>
        <ul>
          <li>Visualiser le projet</li>
          <li>Ajouter des commentaires</li>
          <li>Partager des documents</li>
        </ul>
      </div>
      
      <p style="text-align: center;">
        <a href="${projectUrl}" class="button">Voir le projet</a>
      </p>
    </div>
  `;

  const msg = {
    to: ownerEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
    subject: `✅ ${collaboratorName || collaboratorEmail} a rejoint "${projectTitle}"`,
    html: getEmailTemplate(content)
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email acceptation envoyé via SendGrid');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur envoi email acceptation:', error);
    return { success: false, error: error.message };
  }
}

// Email notification de feedback (pour l'admin)
async function sendFeedbackNotification({
  userEmail,
  userName,
  feedbackType,
  message,
  rating
}) {
  const content = `
    <div class="header">
      <h1>📝 Nouveau Feedback Reçu</h1>
    </div>
    <div class="content">
      <p>Bonjour Admin,</p>
      
      <p>Un nouveau feedback a été soumis sur la plateforme.</p>
      
      <div class="info-box">
        <p><strong>Utilisateur :</strong> ${userName} (${userEmail})</p>
        <p><strong>Type :</strong> ${feedbackType}</p>
        <p><strong>Note :</strong> ${rating}/5 ⭐</p>
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 10px 0;">
        <p><strong>Message :</strong></p>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
      
      <p style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'https://gabon-insight.netlify.app'}/admin/feedbacks" class="button">Voir dans le dashboard</a>
      </p>
    </div>
  `;

  // Récupérer les emails admins depuis la variable d'environnement ou utiliser une valeur par défaut
  const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : ['sowaxcom@gmail.com'];

  const msg = {
    to: adminEmails,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
    subject: `📝 Nouveau Feedback - ${feedbackType} - ${userName}`,
    html: getEmailTemplate(content)
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email feedback envoyé via SendGrid');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur envoi email feedback:', error);
    return { success: false, error: error.message };
  }
}

// Email approbation de campagne
async function sendCampaignApprovalNotification({
  userEmail,
  userName,
  campaignTitle,
  startDate,
  endDate,
  campaignUrl
}) {
  const content = `
    <div class="header">
      <h1>✅ Campagne Approuvée</h1>
    </div>
    <div class="content">
      <p>Bonjour ${userName || ''},</p>
      
      <p>Bonne nouvelle ! Votre campagne publicitaire <strong>${campaignTitle}</strong> a été approuvée par notre équipe.</p>
      
      <div class="info-box">
        <p><strong>📅 Période de diffusion :</strong></p>
        <p>Du ${new Date(startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p>Au ${new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      
      <div class="project-info">
        <h3>🎯 Prochaines étapes</h3>
        <ul>
          <li>✅ Votre campagne est maintenant active</li>
          <li>📊 Consultez les statistiques en temps réel</li>
          <li>🔄 Vous pouvez modifier votre campagne à tout moment</li>
        </ul>
      </div>
      
      <p style="text-align: center;">
        <a href="${campaignUrl}" class="button">Voir ma campagne</a>
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">
        💡 Astuce : Suivez régulièrement vos statistiques pour optimiser votre campagne.
      </p>
    </div>
  `;

  const msg = {
    to: userEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
    subject: `✅ Votre campagne "${campaignTitle}" est approuvée !`,
    html: getEmailTemplate(content)
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email approbation campagne envoyé via SendGrid');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur envoi email approbation:', error);
    return { success: false, error: error.message };
  }
}

// Email rejet de campagne
async function sendCampaignRejectionNotification({
  userEmail,
  userName,
  campaignTitle,
  rejectionReason,
  campaignUrl
}) {
  const content = `
    <div class="header">
      <h1>❌ Campagne Non Approuvée</h1>
    </div>
    <div class="content">
      <p>Bonjour ${userName || ''},</p>
      
      <p>Nous avons examiné votre campagne <strong>${campaignTitle}</strong> et malheureusement, nous ne pouvons pas l'approuver pour le moment.</p>
      
      <div class="info-box" style="background: #fef2f2; border-left-color: #ef4444;">
        <p><strong>📋 Raison du rejet :</strong></p>
        <p style="white-space: pre-wrap;">${rejectionReason}</p>
      </div>
      
      <div class="project-info">
        <h3>🔄 Que faire maintenant ?</h3>
        <ul>
          <li>📝 Modifiez votre campagne selon les recommandations</li>
          <li>🔍 Vérifiez que le contenu respecte nos conditions d'utilisation</li>
          <li>✅ Soumettez à nouveau votre campagne pour révision</li>
        </ul>
      </div>
      
      <p style="text-align: center;">
        <a href="${campaignUrl}" class="button">Modifier ma campagne</a>
      </p>
      
      <p style="color: #6b7280; font-size: 14px;">
        💡 Notre équipe est là pour vous aider. N'hésitez pas à nous contacter si vous avez des questions.
      </p>
    </div>
  `;

  const msg = {
    to: userEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
    subject: `❌ Votre campagne "${campaignTitle}" nécessite des modifications`,
    html: getEmailTemplate(content)
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email rejet campagne envoyé via SendGrid');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur envoi email rejet:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendCollaboratorInvitation,
  sendCommentNotification,
  sendDocumentNotification,
  sendInvitationAcceptedNotification,
  sendFeedbackNotification,
  sendCampaignApprovalNotification,
  sendCampaignRejectionNotification
};
