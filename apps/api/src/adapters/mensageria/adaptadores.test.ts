import { ERRO_CANAL_NAO_CONFIGURADO } from '@convergia/core/envio';
import { describe, expect, it } from 'vitest';
import { MensageriaEmMemoria } from './em-memoria.js';
import { criarWhatsappMegaApi } from './megaapi.js';
import { criarEmailResend } from './resend.js';
import { criarRoteadorMensageria } from './roteador.js';

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
const fetchQueCai: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));

const whats = { canal: 'whatsapp' as const, destinatario: '+5531999998888', corpo: 'Oi' };
const email = { canal: 'email' as const, destinatario: 'a@b.com', corpo: 'Oi' };

describe('MegaAPI (D-07, RN-71)', () => {
  const opcoes = { host: 'https://apinocode01.megaapi.com.br/', instanceKey: 'inst', token: 'tk' };

  it('envia texto no formato da doc e devolve o id da mensagem', async () => {
    const chamadas: Chamada[] = [];
    const m = criarWhatsappMegaApi({
      ...opcoes,
      fetcher: fetchFalso(200, { error: false, messageData: { key: { id: 'ABC' } } }, chamadas),
    });
    expect(await m.enviar(whats)).toEqual({ ok: true, idExterno: 'ABC' });
    expect(chamadas[0]?.url).toBe('https://apinocode01.megaapi.com.br/rest/sendMessage/inst/text');
    expect(chamadas[0]?.init.headers).toMatchObject({ authorization: 'Bearer tk' });
    expect(JSON.parse(chamadas[0]?.init.body as string)).toEqual({
      messageData: { to: '5531999998888@s.whatsapp.net', text: 'Oi' },
    });
  });

  it('número inválido (error: true) é falha definitiva', async () => {
    const m = criarWhatsappMegaApi({
      ...opcoes,
      fetcher: fetchFalso(200, { error: true, message: 'Whatsapp inválido' }),
    });
    expect(await m.enviar(whats)).toEqual({
      ok: false,
      erro: 'megaapi 200: Whatsapp inválido',
      temporario: false,
    });
  });

  it('5xx, 429 e queda de rede são temporários; 401 não', async () => {
    const r500 = await criarWhatsappMegaApi({ ...opcoes, fetcher: fetchFalso(503, {}) }).enviar(
      whats,
    );
    expect(r500).toMatchObject({ ok: false, temporario: true });
    const r429 = await criarWhatsappMegaApi({ ...opcoes, fetcher: fetchFalso(429, {}) }).enviar(
      whats,
    );
    expect(r429).toMatchObject({ temporario: true });
    const rede = await criarWhatsappMegaApi({ ...opcoes, fetcher: fetchQueCai }).enviar(whats);
    expect(rede).toEqual({ ok: false, erro: 'megaapi: TypeError', temporario: true });
    const r401 = await criarWhatsappMegaApi({
      ...opcoes,
      fetcher: fetchFalso(401, { message: 'token' }),
    }).enviar(whats);
    expect(r401).toEqual({ ok: false, erro: 'megaapi 401: token', temporario: false });
  });
});

describe('Resend (RN-71)', () => {
  const opcoes = { apiKey: 're_x', remetente: 'Ag <a@ag.com>', assuntoPadrao: 'Agência' };

  it('envia texto com assunto padrão e devolve o id', async () => {
    const chamadas: Chamada[] = [];
    const m = criarEmailResend({ ...opcoes, fetcher: fetchFalso(200, { id: 'em1' }, chamadas) });
    expect(await m.enviar(email)).toEqual({ ok: true, idExterno: 'em1' });
    expect(chamadas[0]?.url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(chamadas[0]?.init.body as string)).toEqual({
      from: 'Ag <a@ag.com>',
      to: ['a@b.com'],
      subject: 'Agência',
      text: 'Oi',
    });
  });

  it('422 é definitivo; 500 e queda de rede, temporários', async () => {
    expect(
      await criarEmailResend({
        ...opcoes,
        fetcher: fetchFalso(422, { message: 'to inválido' }),
      }).enviar({ ...email, assunto: 'X' }),
    ).toEqual({ ok: false, erro: 'resend 422: to inválido', temporario: false });
    expect(
      await criarEmailResend({ ...opcoes, fetcher: fetchFalso(500, null) }).enviar(email),
    ).toEqual({ ok: false, erro: 'resend 500: resposta inesperada', temporario: true });
    expect(await criarEmailResend({ ...opcoes, fetcher: fetchQueCai }).enviar(email)).toMatchObject(
      {
        temporario: true,
      },
    );
  });
});

describe('roteador por canal (RN-60, RN-71)', () => {
  it('usa o adaptador do canal e responde "não configurado" sem credencial', async () => {
    const memoria = new MensageriaEmMemoria();
    const r = criarRoteadorMensageria({ whatsapp: null, email: memoria });
    expect(await r.enviar(email)).toMatchObject({ ok: true });
    expect(memoria.enviadas).toHaveLength(1);
    expect(await r.enviar(whats)).toEqual({
      ok: false,
      erro: ERRO_CANAL_NAO_CONFIGURADO,
      temporario: true,
    });
  });
});
