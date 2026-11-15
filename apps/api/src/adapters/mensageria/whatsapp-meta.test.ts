import { describe, expect, it } from 'vitest';
import { criarRoteadorMensageria } from './roteador.js';
import { criarWhatsappMeta, normalizarTelefoneMeta, lerMapaDeTemplates } from './whatsapp-meta.js';

interface Chamada {
  url: string;
  init: RequestInit;
}

function fetchFalso(status: number, corpo: unknown, chamadas: Chamada[] = []): typeof fetch {
  return (url, init) => {
    chamadas.push({ url: url instanceof Request ? url.url : url.toString(), init: init ?? {} });
    return Promise.resolve(new Response(JSON.stringify(corpo), { status }));
  };
}
const erroMeta = (code: number, message = 'x') => ({ error: { code, message } });

const opcoes = {
  token: 'tk-secreto',
  phoneNumberId: '1234',
  versaoApi: 'v21.0',
  templates: { convite: 'convite_onboarding' },
  templatePadrao: 'mensagem_geral',
  idioma: 'pt_BR',
};
const msg = {
  canal: 'whatsapp' as const,
  destinatario: '+55 (31) 99999-8888',
  corpo: 'Olá!\nLink: https://x.com/o/abc',
  tipo: 'convite',
};

describe('normalização de telefone (RN-71)', () => {
  it('E.164 sem "+" e só com dígitos', () => {
    expect(normalizarTelefoneMeta('+55 (31) 99999-8888')).toBe('5531999998888');
    expect(normalizarTelefoneMeta('5531999998888')).toBe('5531999998888');
  });
});

describe('WhatsApp oficial da Meta (D-07, RN-61, RN-71)', () => {
  it('envia template aprovado pelo tipo, em pt_BR, e devolve o id', async () => {
    const chamadas: Chamada[] = [];
    const m = criarWhatsappMeta({
      ...opcoes,
      fetcher: fetchFalso(200, { messages: [{ id: 'wamid.1' }] }, chamadas),
    });
    expect(await m.enviar(msg)).toEqual({ ok: true, idExterno: 'wamid.1' });
    expect(chamadas[0]?.url).toBe('https://graph.facebook.com/v21.0/1234/messages');
    expect(chamadas[0]?.init.headers).toMatchObject({ authorization: 'Bearer tk-secreto' });
    expect(JSON.parse(chamadas[0]?.init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      to: '5531999998888',
      type: 'template',
      template: {
        name: 'convite_onboarding',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            // Meta não aceita quebra de linha dentro do parâmetro.
            parameters: [{ type: 'text', text: 'Olá! Link: https://x.com/o/abc' }],
          },
        ],
      },
    });
  });

  it('tipo sem mapeamento usa o template padrão', async () => {
    const chamadas: Chamada[] = [];
    const m = criarWhatsappMeta({
      ...opcoes,
      fetcher: fetchFalso(200, { messages: [{ id: 'w' }] }, chamadas),
    });
    await m.enviar({ ...msg, tipo: 'lembrete_pendencia' });
    expect(JSON.parse(chamadas[0]?.init.body as string)).toMatchObject({
      template: { name: 'mensagem_geral' },
    });
  });

  it('erros definitivos: número sem WhatsApp, template inexistente, fora da janela, token', async () => {
    for (const code of [131026, 132001, 132000, 131047, 131030, 190, 100]) {
      const m = criarWhatsappMeta({ ...opcoes, fetcher: fetchFalso(400, erroMeta(code, 'ruim')) });
      expect(await m.enviar(msg)).toEqual({
        ok: false,
        erro: `meta ${String(code)}: ruim`,
        temporario: false,
      });
    }
  });

  it('erros temporários: limite de envio, indisponível, 5xx, 429 e queda de rede', async () => {
    for (const [status, code] of [
      [400, 130429],
      [400, 131056],
      [400, 131016],
      [400, 4],
      [500, 1],
      [429, 0],
    ] as const) {
      const m = criarWhatsappMeta({ ...opcoes, fetcher: fetchFalso(status, erroMeta(code)) });
      expect(await m.enviar(msg)).toMatchObject({ ok: false, temporario: true });
    }
    const cai = criarWhatsappMeta({
      ...opcoes,
      fetcher: () => Promise.reject(new TypeError('fetch failed')),
    });
    expect(await cai.enviar(msg)).toEqual({ ok: false, erro: 'meta: TypeError', temporario: true });
  });

  it('200 sem id da mensagem é falha definitiva e o token nunca aparece no erro', async () => {
    const m = criarWhatsappMeta({ ...opcoes, fetcher: fetchFalso(200, { x: 1 }) });
    const r = await m.enviar(msg);
    expect(r).toMatchObject({ ok: false, temporario: false });
    expect(JSON.stringify(r)).not.toContain('tk-secreto');
  });

  it('sem template para o tipo e sem padrão, falha definitiva (não chama a Meta)', async () => {
    const chamadas: Chamada[] = [];
    const m = criarWhatsappMeta({
      ...opcoes,
      templates: {},
      templatePadrao: undefined,
      fetcher: fetchFalso(200, {}, chamadas),
    });
    expect(await m.enviar(msg)).toEqual({
      ok: false,
      erro: 'meta: sem_template_para_convite',
      temporario: false,
    });
    expect(chamadas).toHaveLength(0);
  });
});

describe('mapa de templates da configuração', () => {
  it('lê "tipo=nome,tipo=nome" e ignora linhas vazias', () => {
    expect(lerMapaDeTemplates('convite=a, lembrete_pendencia=b,,')).toEqual({
      convite: 'a',
      lembrete_pendencia: 'b',
    });
    expect(lerMapaDeTemplates(undefined)).toEqual({});
  });
});

describe('seleção do provedor e sem credenciais (RN-60)', () => {
  it('sem adaptador de WhatsApp, o roteador responde "não configurado"', async () => {
    const r = criarRoteadorMensageria({ whatsapp: null, email: null });
    expect(await r.enviar(msg)).toMatchObject({ ok: false, temporario: true });
  });
});
