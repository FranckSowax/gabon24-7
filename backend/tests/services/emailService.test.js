const sgMail = require('@sendgrid/mail');
const emailService = require('../../services/emailService');

// Mock SendGrid
jest.mock('@sendgrid/mail');

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendCampaignApprovalNotification', () => {
    it('devrait envoyer un email d\'approbation de campagne', async () => {
      sgMail.send.mockResolvedValue([{ statusCode: 202 }]);

      const result = await emailService.sendCampaignApprovalNotification({
        userEmail: 'user@example.com',
        userName: 'John Doe',
        campaignTitle: 'Test Campaign',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        campaignUrl: 'https://example.com/campaign/123'
      });

      expect(result.success).toBe(true);
      expect(sgMail.send).toHaveBeenCalledTimes(1);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Test Campaign')
        })
      );
    });

    it('devrait gérer les erreurs d\'envoi', async () => {
      sgMail.send.mockRejectedValue(new Error('SendGrid error'));

      const result = await emailService.sendCampaignApprovalNotification({
        userEmail: 'user@example.com',
        userName: 'John Doe',
        campaignTitle: 'Test Campaign',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        campaignUrl: 'https://example.com/campaign/123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SendGrid error');
    });
  });

  describe('sendCampaignRejectionNotification', () => {
    it('devrait envoyer un email de rejet de campagne', async () => {
      sgMail.send.mockResolvedValue([{ statusCode: 202 }]);

      const result = await emailService.sendCampaignRejectionNotification({
        userEmail: 'user@example.com',
        userName: 'John Doe',
        campaignTitle: 'Test Campaign',
        rejectionReason: 'Contenu inapproprié',
        campaignUrl: 'https://example.com/campaign/123'
      });

      expect(result.success).toBe(true);
      expect(sgMail.send).toHaveBeenCalledTimes(1);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Test Campaign')
        })
      );
    });
  });

  describe('sendCollaboratorInvitation', () => {
    it('devrait envoyer une invitation de collaboration', async () => {
      sgMail.send.mockResolvedValue([{ statusCode: 202 }]);

      const result = await emailService.sendCollaboratorInvitation({
        collaboratorEmail: 'collab@example.com',
        ownerName: 'Jane Doe',
        projectTitle: 'Test Project',
        projectDescription: 'Description du projet',
        invitationId: '123',
        acceptUrl: 'https://example.com/accept/123',
        rejectUrl: 'https://example.com/reject/123'
      });

      expect(result.success).toBe(true);
      expect(sgMail.send).toHaveBeenCalledTimes(1);
    });
  });
});
