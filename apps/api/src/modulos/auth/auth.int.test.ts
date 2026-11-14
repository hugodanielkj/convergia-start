import { randomUUID } from 'node:crypto';
import { relogioFixo } from '@convergia/core/base';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import type { DadosIdentidade, ProvedorIdentidade } from '../../base/auth.js';
import { criarPrisma } from '../../base/prisma.js';
import { AGORA_TESTE, URL_BANCO_TESTE, dependenciasDeTeste } from '../../testes/dependencias.js';
import { criarSessao, hashToken, resolvedorSessaoCookie } from './sessoes.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID();
const emailAdmin = `admin-${sufixo}@exemplo.com`;
const emailInativo = `inativo-${sufixo}@exemplo.com`;
const emailDuplicado = `dup-${sufixo}@exemplo.com`;
const agencias: string[] = [];
let adminId: string;

beforeAll(async () => {
  const [a, b] = await Promise.all([
    prisma.agencia.create({ data: { nome: 'A' } }),
    prisma.agencia.create({ data: { nome: 'B' } }),
  ]);
  agencias.push(a.id, b.id);
  adminId = (
    await prisma.usuario.create({
      data: { agenciaId: a.id, nome: 'Dona', email: emailAdmin, papel: 'admin' },
    })
  ).id;
  await prisma.usuario.createMany({
    data: [
      { agenciaId: a.id, nome: 'Inativa', email: emailInativo, ativo: false },
      { agenciaId: a.id, nome: 'Dup A', email: emailDuplicado },
      { agenciaId: b.id, nome: 'Dup B', email: emailDuplicado },
    ],
  });
});

afterAll(async () => {
  await prisma.agencia.deleteMany({ where: { id: { in: agencias } } });
  await prisma.$disconnect();
});

/** Provedor falso: devolve a identidade configurada se o state da URL bater. */
function provedorFalso(resultado: DadosIdentidade | Error): ProvedorIdentidade {
  return {
    urlAutorizacao: ({ state }) =>
      Promise.resolve(new URL(`https://google.fake/auth?state=${state}`)),
    concluir: (url, verificacao) => {
      if (url.searchParams.get('state') !== verificacao.state) {
        return Promise.reject(new Error('state'));
      }
      return resultado instanceof Error ? Promise.reject(resultado) : Promise.resolve(resultado);
    },
  };
}

function criarAppTeste(identidade: ProvedorIdentidade | null, agora = AGORA_TESTE) {
  const base = dependenciasDeTeste({ prisma, relogio: relogioFixo(agora) });
  return construirApp(
    { LOG_LEVEL: 'silent' },
    {
      ...base,
      resolverSessao: resolvedorSessaoCookie(prisma, base.relogio),
      auth: { ...base.auth, identidade },
    },
  );
}

const identidade = (email: string, emailVerificado = true): DadosIdentidade => ({
  email,
  emailVerificado,
  nome: 'Qualquer',
});

/** Faz o fluxo completo e devolve a resposta do callback. */
async function entrar(app: ReturnType<typeof criarAppTeste>, stateNoRetorno?: string) {
  const inicio = await app.inject('/auth/google');
  const state = new URL(String(inicio.headers.location)).searchParams.get('state') ?? '';
  const oauth = inicio.cookies.find((c) => c.name === 'oauth_google');
  return app.inject({
    url: `/auth/google/callback?code=abc&state=${stateNoRetorno ?? state}`,
    cookies: oauth ? { oauth_google: oauth.value } : {},
  });
}

const erroDe = (location: unknown) => new URL(String(location)).searchParams.get('erro');

describe('S1-2 login com Google (D-21)', () => {
  it('admin cadastrado entra, recebe sessão, e o login é auditado (RN-77)', async () => {
    const app = criarAppTeste(provedorFalso(identidade(emailAdmin.toUpperCase())));
    const resposta = await entrar(app);

    expect(resposta.statusCode).toBe(303);
    expect(resposta.headers.location).toBe('http://localhost:3000/');
    const sessao = resposta.cookies.find((c) => c.name === 'sessao');
    expect(sessao).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

    const eu = await app.inject({ url: '/auth/eu', cookies: { sessao: sessao?.value ?? '' } });
    expect(eu.json()).toEqual({ id: adminId, nome: 'Dona', email: emailAdmin, papel: 'admin' });

    const auditoria = await prisma.auditoriaLog.findFirst({
      where: { entidadeId: adminId, acao: 'login' },
    });
    expect(auditoria?.ator).toBe(`usuario:${adminId}`);
    await app.close();
  });

  it('não grava o token da sessão no banco, só o hash', async () => {
    const app = criarAppTeste(provedorFalso(identidade(emailAdmin)));
    const token = (await entrar(app)).cookies.find((c) => c.name === 'sessao')?.value ?? '';
    expect(await prisma.sessao.findUnique({ where: { id: token } })).toBeNull();
    expect(await prisma.sessao.findUnique({ where: { id: hashToken(token) } })).not.toBeNull();
    await app.close();
  });

  it.each([
    ['e-mail não cadastrado', identidade(`outro-${sufixo}@exemplo.com`)],
    ['e-mail não verificado pelo Google', identidade(emailAdmin, false)],
    ['usuário inativo', identidade(emailInativo)],
    ['e-mail em mais de uma agência', identidade(emailDuplicado)],
  ])('recusa %s sem criar sessão', async (_caso, dados) => {
    const app = criarAppTeste(provedorFalso(dados));
    const resposta = await entrar(app);
    expect(erroDe(resposta.headers.location)).toBe('nao-autorizado');
    expect(resposta.cookies.find((c) => c.name === 'sessao')).toBeUndefined();
    await app.close();
  });

  it('recusa retorno com state diferente do enviado (proteção CSRF do OAuth)', async () => {
    const app = criarAppTeste(provedorFalso(identidade(emailAdmin)));
    expect(erroDe((await entrar(app, 'forjado')).headers.location)).toBe('falha');
    await app.close();
  });

  it('recusa retorno sem o cookie de verificação', async () => {
    const app = criarAppTeste(provedorFalso(identidade(emailAdmin)));
    const resposta = await app.inject('/auth/google/callback?code=abc&state=x');
    expect(erroDe(resposta.headers.location)).toBe('falha');
    await app.close();
  });

  it('recusa cookie de verificação adulterado', async () => {
    const app = criarAppTeste(provedorFalso(identidade(emailAdmin)));
    const resposta = await app.inject({
      url: '/auth/google/callback?code=abc&state=x',
      cookies: { oauth_google: '{"state":"x","nonce":"n","codeVerifier":"v"}.assinaturafalsa' },
    });
    expect(erroDe(resposta.headers.location)).toBe('falha');
    await app.close();
  });

  it('trata falha do Google como erro genérico', async () => {
    const app = criarAppTeste(provedorFalso(new Error('Google fora do ar')));
    expect(erroDe((await entrar(app)).headers.location)).toBe('falha');
    await app.close();
  });

  it('sem Google configurado, as duas rotas respondem "indisponível"', async () => {
    const app = criarAppTeste(null);
    expect(erroDe((await app.inject('/auth/google')).headers.location)).toBe('indisponivel');
    expect(erroDe((await app.inject('/auth/google/callback')).headers.location)).toBe(
      'indisponivel',
    );
    await app.close();
  });
});

describe('S1-2 sessão', () => {
  it('sessão expirada não autentica', async () => {
    const { token } = await criarSessao(
      prisma,
      { id: adminId, agenciaId: agencias[0] ?? '' },
      new Date(AGORA_TESTE.getTime() - 10 * 3_600_000),
      1,
    );
    const app = criarAppTeste(null);
    expect((await app.inject({ url: '/auth/eu', cookies: { sessao: token } })).statusCode).toBe(
      401,
    );
    await app.close();
  });

  it('cookie de sessão inválido não autentica', async () => {
    const app = criarAppTeste(null);
    const r = await app.inject({ url: '/auth/eu', cookies: { sessao: 'inventado' } });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it('sair apaga a sessão, limpa o cookie e audita o logout (RN-77)', async () => {
    const app = criarAppTeste(provedorFalso(identidade(emailAdmin)));
    const token = (await entrar(app)).cookies.find((c) => c.name === 'sessao')?.value ?? '';

    const saida = await app.inject({
      method: 'POST',
      url: '/auth/sair',
      cookies: { sessao: token },
    });

    expect(saida.statusCode).toBe(303);
    expect(saida.headers.location).toBe('http://localhost:3000/entrar');
    expect(saida.cookies.find((c) => c.name === 'sessao')?.value).toBe('');
    expect(await prisma.sessao.findUnique({ where: { id: hashToken(token) } })).toBeNull();
    expect(
      await prisma.auditoriaLog.count({ where: { entidadeId: adminId, acao: 'logout' } }),
    ).toBeGreaterThan(0);
    expect((await app.inject({ url: '/auth/eu', cookies: { sessao: token } })).statusCode).toBe(
      401,
    );
    await app.close();
  });

  it('sair sem sessão só redireciona', async () => {
    const app = criarAppTeste(null);
    const saida = await app.inject({ method: 'POST', url: '/auth/sair' });
    expect(saida.headers.location).toBe('http://localhost:3000/entrar');
    await app.close();
  });
});
