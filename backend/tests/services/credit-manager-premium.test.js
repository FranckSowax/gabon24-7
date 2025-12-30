const { checkCredits, consumeCredits } = require('../../services/credit-manager-premium');
const supabaseService = require('../../supabase-config');

// Mock Supabase
jest.mock('../../supabase-config');

describe('Credit Manager Premium', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkCredits', () => {
    it('devrait retourner hasEnough=true si crédits suffisants', async () => {
      supabaseService.supabase.rpc = jest.fn().mockResolvedValue({
        data: {
          has_enough: true,
          balance: 100,
          required: 10,
          missing: 0
        },
        error: null
      });

      const result = await checkCredits('user-123', 'chat_message');

      expect(result.hasEnough).toBe(true);
      expect(result.balance).toBe(100);
      expect(result.required).toBe(10);
      expect(supabaseService.supabase.rpc).toHaveBeenCalledWith(
        'check_user_credits',
        expect.objectContaining({
          p_user_id: 'user-123',
          p_service_name: 'chat_message'
        })
      );
    });

    it('devrait retourner hasEnough=false si crédits insuffisants', async () => {
      supabaseService.supabase.rpc = jest.fn().mockResolvedValue({
        data: {
          has_enough: false,
          balance: 5,
          required: 10,
          missing: 5
        },
        error: null
      });

      const result = await checkCredits('user-123', 'chat_message');

      expect(result.hasEnough).toBe(false);
      expect(result.missing).toBe(5);
    });

    it('devrait gérer les erreurs RPC', async () => {
      supabaseService.supabase.rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'RPC error' }
      });

      const result = await checkCredits('user-123', 'chat_message');

      expect(result.hasEnough).toBe(false);
    });
  });

  describe('consumeCredits', () => {
    it('devrait consommer les crédits avec succès', async () => {
      supabaseService.supabase.rpc = jest.fn().mockResolvedValue({
        data: {
          success: true,
          balance: 90,
          transaction_id: 'txn-123'
        },
        error: null
      });

      const result = await consumeCredits('user-123', 'chat_message', 10);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(90);
      expect(supabaseService.supabase.rpc).toHaveBeenCalledWith(
        'consume_credits',
        expect.objectContaining({
          p_user_id: 'user-123',
          p_amount: 10,
          p_service_name: 'chat_message'
        })
      );
    });

    it('devrait échouer si crédits insuffisants', async () => {
      supabaseService.supabase.rpc = jest.fn().mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient credits'
        },
        error: null
      });

      const result = await consumeCredits('user-123', 'chat_message', 100);

      expect(result.success).toBe(false);
    });
  });
});
