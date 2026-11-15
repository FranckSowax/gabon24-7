/**
 * Fournisseur des appels d'IA texte : choix OpenRouter / repli OpenAI, modèle
 * imposé, marge de raisonnement. Aucun appel réseau : le transport est simulé.
 */

const {
  getAiProvider,
  isAiConfigured,
  getAiModel,
  adaptChatParams,
  createAiClient,
  chatCompletion,
  REASONING_HEADROOM_TOKENS,
} = require('../../services/ai-provider');
const netlifyProvider = require('../../../netlify/functions/utils/ai-provider');

const OPENROUTER = { OPENROUTER_API_KEY: 'cle-openrouter-de-test' };
const OPENAI = { OPENAI_API_KEY: 'cle-openai-de-test' };

describe('choix du fournisseur', () => {
  it('utilise OpenRouter et GLM 5.3 Flash dès que sa clé est posée', () => {
    const provider = getAiProvider({ ...OPENROUTER, ...OPENAI });
    expect(provider).toMatchObject({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'z-ai/glm-5.3-flash',
      reasoningEffort: 'low',
    });
    expect(getAiModel(OPENROUTER)).toBe('z-ai/glm-5.3-flash');
  });

  it('se replie sur OpenAI tant que la clé OpenRouter manque', () => {
    expect(getAiProvider(OPENAI)).toMatchObject({ name: 'openai', model: 'gpt-4.1-mini', baseURL: undefined });
  });

  it('signale l\'absence de toute clé', () => {
    expect(getAiProvider({})).toBeNull();
    expect(isAiConfigured({})).toBe(false);
    expect(getAiModel({})).toBeNull();
    expect(createAiClient({}, {})).toBeNull();
    expect(isAiConfigured(OPENROUTER)).toBe(true);
  });

  it('accepte un autre modèle et un autre effort, et ignore un effort inconnu', () => {
    expect(getAiProvider({ ...OPENROUTER, AI_MODEL: 'z-ai/glm-5.3', AI_REASONING_EFFORT: 'HIGH' }))
      .toMatchObject({ model: 'z-ai/glm-5.3', reasoningEffort: 'high' });
    expect(getAiProvider({ ...OPENROUTER, AI_REASONING_EFFORT: 'none' }).reasoningEffort).toBe('low');
  });
});

describe('ajustement des demandes', () => {
  const provider = getAiProvider(OPENROUTER);

  it('impose le modèle configuré, même si le code demande encore un modèle OpenAI', () => {
    expect(adaptChatParams({ model: 'gpt-4.1-mini', messages: [] }, provider).model).toBe('z-ai/glm-5.3-flash');
    expect(adaptChatParams({ messages: [] }, provider).model).toBe('z-ai/glm-5.3-flash');
  });

  it('demande l\'effort de raisonnement le plus bas', () => {
    expect(adaptChatParams({ messages: [] }, provider).reasoning).toEqual({ effort: 'low' });
  });

  it('ajoute la marge de raisonnement aux petites limites de réponse', () => {
    expect(adaptChatParams({ messages: [], max_tokens: 10 }, provider).max_tokens).toBe(10 + REASONING_HEADROOM_TOKENS);
    expect(adaptChatParams({ messages: [] }, provider).max_tokens).toBeUndefined();
  });

  it('conserve les autres réglages et ne modifie pas la demande d\'origine', () => {
    const original = { messages: [{ role: 'user', content: 'x' }], temperature: 0.2, stream: true, max_tokens: 50 };
    const adapted = adaptChatParams(original, provider);
    expect(adapted).toMatchObject({ temperature: 0.2, stream: true, messages: original.messages });
    expect(original).toEqual({ messages: [{ role: 'user', content: 'x' }], temperature: 0.2, stream: true, max_tokens: 50 });
  });

  it('en repli OpenAI, laisse la demande telle quelle', () => {
    const openai = getAiProvider(OPENAI);
    expect(adaptChatParams({ model: 'gpt-4o-mini', max_tokens: 10, messages: [] }, openai))
      .toEqual({ model: 'gpt-4o-mini', max_tokens: 10, messages: [] });
    expect(adaptChatParams({ messages: [] }, openai).model).toBe('gpt-4.1-mini');
  });
});

describe('client', () => {
  function captureFetch() {
    const calls = [];
    const fetchMock = async (url, init) => {
      calls.push({ url: String(url), headers: Object.fromEntries(new Headers(init.headers).entries()), body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ id: 'x', choices: [{ message: { role: 'assistant', content: 'ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    return { calls, fetchMock };
  }

  it('envoie la demande à OpenRouter avec le modèle, l\'effort et la marge', async () => {
    const { calls, fetchMock } = captureFetch();
    const client = createAiClient({ fetch: fetchMock, maxRetries: 0 }, OPENROUTER);
    const completion = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'Bonjour' }],
      max_tokens: 200,
    });

    expect(completion.choices[0].message.content).toBe('ok');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0].headers.authorization).toBe('Bearer cle-openrouter-de-test');
    expect(calls[0].headers['x-title']).toBe('Gabon Insight');
    expect(calls[0].body).toMatchObject({
      model: 'z-ai/glm-5.3-flash',
      reasoning: { effort: 'low' },
      max_tokens: 200 + REASONING_HEADROOM_TOKENS,
    });
  });

  it('en repli, appelle OpenAI sans rien ajouter', async () => {
    const { calls, fetchMock } = captureFetch();
    await chatCompletion({ model: 'gpt-4.1-mini', messages: [], max_tokens: 50 }, { fetch: fetchMock, maxRetries: 0 }, OPENAI);
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect(calls[0].body).toEqual({ model: 'gpt-4.1-mini', messages: [], max_tokens: 50 });
  });

  it('refuse l\'appel direct quand aucune clé n\'est configurée', async () => {
    await expect(chatCompletion({ messages: [] }, {}, {})).rejects.toThrow('Service IA non configuré');
  });
});

describe('fonctions Netlify', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('applique la même règle que le serveur', () => {
    const provider = netlifyProvider.getAiProvider(OPENROUTER);
    expect(provider).toMatchObject({ name: 'openrouter', model: 'z-ai/glm-5.3-flash', url: 'https://openrouter.ai/api/v1/chat/completions' });
    expect(netlifyProvider.adaptChatParams({ model: 'gpt-4.1-mini', max_tokens: 150, messages: [] }, provider))
      .toEqual({ model: 'z-ai/glm-5.3-flash', max_tokens: 150 + REASONING_HEADROOM_TOKENS, messages: [], reasoning: { effort: 'low' } });
    expect(netlifyProvider.getAiProvider(OPENAI)).toMatchObject({ name: 'openai', url: 'https://api.openai.com/v1/chat/completions' });
    expect(netlifyProvider.isAiConfigured({})).toBe(false);
  });

  it('envoie la demande ajustée et renvoie la réponse brute', async () => {
    const calls = [];
    global.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200 }; };
    const response = await netlifyProvider.fetchChatCompletion({ messages: [], max_tokens: 150 }, OPENROUTER);
    expect(response.status).toBe(200);
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0].init.headers.Authorization).toBe('Bearer cle-openrouter-de-test');
    expect(JSON.parse(calls[0].init.body).model).toBe('z-ai/glm-5.3-flash');
  });

  it('refuse l\'appel quand aucune clé n\'est configurée', async () => {
    await expect(netlifyProvider.fetchChatCompletion({ messages: [] }, {})).rejects.toThrow('Service IA non configuré');
  });
});
