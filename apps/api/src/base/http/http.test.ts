import Fastify, { type FastifyInstance, type InjectOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registrarTratamentoDeErros } from '../erros.js';
import type { ConfigHttp, LimitesPublicos } from './config.js';
import { ContadorEmMemoria } from './contador-janela.js';
import { pluginHttp } from './index.js';

const URL_APP = 'http://localhost:3000';
const TOKEN_VALIDO = 'token-valido';
const LIMITES: LimitesPublicos = {
  janelaMs: 60_000,
  porIp: 5,
  porToken: 3,
  tokensInvalidosPorIp: 2,
  janelaTokensInvalidosMs: 15 * 60_000,
};

let agora = 0;
let app: FastifyInstance;

function montar(http: Partial<ConfigHttp> = {}): FastifyInstance {
  agora = 1_000_000;
  app = Fastify({ trustProxy: http.confiarProxy ?? 'loopback' });
  registrarTratamentoDeErros(app);
  const config: ConfigHttp = {
    confiarProxy: 'loopback',
    hsts: false,
    limites: LIMITES,
    contador: new ContadorEmMemoria(() => agora),
    ...http,
  };
  void app.register(pluginHttp, { http: config, urlApp: URL_APP, agora: () => agora });
  // Rotas de mentira no formato das públicas: só o token "token-valido" existe.
  app.get('/publico/onboardings/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    return token === TOKEN_VALIDO ? { ok: true } : reply.code(404).send({ erro: 'NAO_ENCONTRADO' });
  });
  app.post('/publico/onboardings/:token/formulario/enviar', async () => ({ ok: true }));
  app.post('/clientes', async () => ({ ok: true }));
  app.get('/painel/onboardings', async () => ({ ok: true }));
  return app;
}

afterEach(async () => {
  await app.close();
});

/** Requisição de um cliente da internet passando pelo proxy local (a web). */
const doCliente = (ip: string, opcoes: InjectOptions): InjectOptions => ({
  remoteAddress: '127.0.0.1',
  ...opcoes,
  headers: { 'x-forwarded-for': ip, ...opcoes.headers },
});

const abrirLink = (ip: string, token = TOKEN_VALIDO) =>
  app.inject(doCliente(ip, { method: 'GET', url: `/publico/onboardings/${token}` }));

describe('RN-76 limite de requisições nas rotas públicas', () => {
  it('recusa com 429 e Retry-After quando o mesmo IP passa do limite', async () => {
    montar({ limites: { ...LIMITES, porToken: 0 } });
    for (let i = 0; i < LIMITES.porIp; i += 1) {
      expect((await abrirLink('203.0.113.1')).statusCode).toBe(200);
    }

    const recusada = await abrirLink('203.0.113.1');

    expect(recusada.statusCode).toBe(429);
    expect(recusada.headers['retry-after']).toBe('60');
    expect(recusada.json()).toMatchObject({ erro: 'LIMITE_REQUISICOES' });
  });

  it('conta cada IP separado e libera de novo quando a janela vira', async () => {
    montar({ limites: { ...LIMITES, porToken: 0 } });
    for (let i = 0; i <= LIMITES.porIp; i += 1) await abrirLink('203.0.113.1');
    expect((await abrirLink('203.0.113.1')).statusCode).toBe(429);
    expect((await abrirLink('203.0.113.2')).statusCode).toBe(200);

    agora += LIMITES.janelaMs;

    expect((await abrirLink('203.0.113.1')).statusCode).toBe(200);
  });

  it('limita o mesmo token mesmo vindo de IPs diferentes', async () => {
    montar();
    for (let i = 0; i < LIMITES.porToken; i += 1) {
      expect((await abrirLink(`198.51.100.${String(i)}`)).statusCode).toBe(200);
    }

    expect((await abrirLink('198.51.100.99')).statusCode).toBe(429);
  });

  it('bloqueia o IP que erra tokens demais, inclusive para um token válido, até a janela vencer', async () => {
    montar();
    expect((await abrirLink('203.0.113.7', 'chute-1')).statusCode).toBe(404);
    expect((await abrirLink('203.0.113.7', 'chute-2')).statusCode).toBe(404);

    const bloqueada = await abrirLink('203.0.113.7');
    expect(bloqueada.statusCode).toBe(429);
    expect(bloqueada.headers['retry-after']).toBe('900');
    expect((await abrirLink('203.0.113.8')).statusCode).toBe(200);

    agora += LIMITES.janelaTokensInvalidosMs;
    expect((await abrirLink('203.0.113.7')).statusCode).toBe(200);
  });

  it('responde igual (429) para token existente ou não depois do limite, sem revelar qual existe', async () => {
    montar({ limites: { ...LIMITES, porToken: 0, tokensInvalidosPorIp: 0 } });
    for (let i = 0; i < LIMITES.porIp; i += 1) await abrirLink('203.0.113.9', `chute-${String(i)}`);

    const existente = await abrirLink('203.0.113.9');
    const inexistente = await abrirLink('203.0.113.9', 'outro-chute');

    expect(existente.statusCode).toBe(429);
    expect(inexistente.statusCode).toBe(429);
    expect(existente.body).toBe(inexistente.body);
  });

  it('usa o IP do X-Forwarded-For só quando a conexão vem do proxy confiável', async () => {
    montar({ limites: { ...LIMITES, porToken: 0 } });
    // Conexão direta de fora: o cabeçalho é ignorado e o IP é o da conexão.
    for (let i = 0; i <= LIMITES.porIp; i += 1) {
      await app.inject({
        method: 'GET',
        url: `/publico/onboardings/${TOKEN_VALIDO}`,
        remoteAddress: '192.0.2.50',
        headers: { 'x-forwarded-for': `203.0.113.${String(i)}` },
      });
    }

    const trocandoCabecalho = await app.inject({
      method: 'GET',
      url: `/publico/onboardings/${TOKEN_VALIDO}`,
      remoteAddress: '192.0.2.50',
      headers: { 'x-forwarded-for': '203.0.113.200' },
    });

    expect(trocandoCabecalho.statusCode).toBe(429);
  });

  it('chamada interna sem IP do cliente (render do servidor) só conta por token', async () => {
    montar({ limites: { ...LIMITES, porToken: 100 } });
    for (let i = 0; i < LIMITES.porIp * 3; i += 1) {
      const resposta = await app.inject({
        method: 'GET',
        url: `/publico/onboardings/chute-${String(i)}`,
        remoteAddress: '10.0.0.5',
      });
      expect(resposta.statusCode).toBe(404);
    }
  });

  it('não limita rotas fora de /publico', async () => {
    montar();
    for (let i = 0; i < LIMITES.porIp * 2; i += 1) {
      const resposta = await app.inject(
        doCliente('203.0.113.1', { method: 'GET', url: '/painel/onboardings' }),
      );
      expect(resposta.statusCode).toBe(200);
    }
  });

  it('com o limite desligado, não recusa', async () => {
    montar({ limites: null });
    for (let i = 0; i < LIMITES.porIp * 2; i += 1) {
      expect((await abrirLink('203.0.113.1', `chute-${String(i)}`)).statusCode).toBe(404);
    }
  });
});

describe('RN-76 proteção contra CSRF nas mutações', () => {
  const enviar = (headers: Record<string, string>, url = '/clientes') =>
    app.inject({ method: 'POST', url, headers, payload: {} });

  it('aceita mutação da própria web (mesma origem)', async () => {
    montar();
    const resposta = await enviar({ origin: URL_APP, 'sec-fetch-site': 'same-origin' });
    expect(resposta.statusCode).toBe(200);
  });

  it('recusa mutação com Origin de outro site', async () => {
    montar();
    const resposta = await enviar({ origin: 'https://site-malicioso.example' });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ erro: 'RN-76' });
  });

  it('recusa mutação marcada pelo navegador como de outro site, mesmo sem Origin', async () => {
    montar();
    expect((await enviar({ 'sec-fetch-site': 'cross-site' })).statusCode).toBe(403);
    expect((await enviar({ 'sec-fetch-site': 'same-site' })).statusCode).toBe(403);
  });

  it('recusa Origin "null" (iframe com sandbox ou arquivo local)', async () => {
    montar();
    expect((await enviar({ origin: 'null' })).statusCode).toBe(403);
  });

  it('vale também para as rotas públicas do link', async () => {
    montar();
    const resposta = await enviar(
      { origin: 'https://site-malicioso.example' },
      `/publico/onboardings/${TOKEN_VALIDO}/formulario/enviar`,
    );
    expect(resposta.statusCode).toBe(403);
  });

  it('aceita chamada sem Origin nem Sec-Fetch-Site (servidor da web, scripts)', async () => {
    montar();
    expect((await enviar({})).statusCode).toBe(200);
  });

  it('não exige origem em leitura (GET)', async () => {
    montar();
    const resposta = await app.inject({
      method: 'GET',
      url: '/painel/onboardings',
      headers: { origin: 'https://site-malicioso.example', 'sec-fetch-site': 'cross-site' },
    });
    expect(resposta.statusCode).toBe(200);
  });
});

describe('RN-76 cabeçalhos de segurança', () => {
  it('toda resposta sai com CSP fechada, nosniff, sem iframe e sem referrer', async () => {
    montar();
    const resposta = await app.inject({ method: 'GET', url: '/painel/onboardings' });

    expect(resposta.headers['content-security-policy']).toContain("default-src 'none'");
    expect(resposta.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(resposta.headers['content-security-policy']).toContain('sandbox');
    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(resposta.headers['x-frame-options']).toBe('DENY');
    expect(resposta.headers['referrer-policy']).toBe('no-referrer');
    expect(resposta.headers['strict-transport-security']).toBeUndefined();
  });

  it('respostas de erro e de limite também levam os cabeçalhos', async () => {
    montar();
    const resposta = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: { origin: 'https://site-malicioso.example' },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.headers['x-frame-options']).toBe('DENY');
  });

  it('HSTS só quando ligado (produção)', async () => {
    montar({ hsts: true });
    const resposta = await app.inject({ method: 'GET', url: '/painel/onboardings' });
    expect(resposta.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });

  it('respostas do link não ficam em cache', async () => {
    montar();
    const resposta = await abrirLink('203.0.113.1');
    expect(resposta.headers['cache-control']).toBe('no-store');
  });
});
