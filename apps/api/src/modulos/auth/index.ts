import { createHash } from 'node:crypto';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, usuarioDaRequisicao, type VerificacaoLogin } from '../../base/auth.js';
import { registrarAuditoria } from '../../base/auditoria.js';
import { COOKIE_SESSAO, criarSessao, hashToken, tokenAleatorio } from './sessoes.js';

const COOKIE_OAUTH = 'oauth_google';
const DEZ_MINUTOS = 600;

type CodigoErro = 'indisponivel' | 'falha' | 'nao-autorizado';

const esquemaVerificacao = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  codeVerifier: z.string().min(1),
});

const lerJson = (texto: string): unknown => {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
};

const desafioPkce = (verificador: string) =>
  createHash('sha256').update(verificador).digest('base64url');

/**
 * Login da equipe com Google (S1-2, D-21). Rotas sob /auth; a web as expõe em /api/auth.
 * Erros voltam para /entrar?erro=<código> sem revelar o motivo exato (ex.: e-mail inexistente).
 */
export default async function moduloAuth(app: FastifyInstance): Promise<void> {
  const { auth } = app.deps;
  const urlRetornoGoogle = `${auth.urlApp}/api/auth/google/callback`;
  const cookieBase: CookieSerializeOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: auth.urlApp.startsWith('https://'),
    path: '/',
  };
  const voltarComErro = (reply: FastifyReply, erro: CodigoErro) =>
    reply.redirect(`${auth.urlApp}/entrar?erro=${erro}`, 303);

  app.get('/auth/google', async (_request, reply) => {
    if (!auth.identidade) return voltarComErro(reply, 'indisponivel');
    const verificacao: VerificacaoLogin = {
      state: tokenAleatorio(),
      nonce: tokenAleatorio(),
      codeVerifier: tokenAleatorio(),
    };
    const destino = await auth.identidade.urlAutorizacao({
      state: verificacao.state,
      nonce: verificacao.nonce,
      codeChallenge: desafioPkce(verificacao.codeVerifier),
    });
    reply.setCookie(COOKIE_OAUTH, JSON.stringify(verificacao), {
      ...cookieBase,
      signed: true,
      maxAge: DEZ_MINUTOS,
    });
    return reply.redirect(destino.href, 303);
  });

  app.get('/auth/google/callback', async (request, reply) => {
    if (!auth.identidade) return voltarComErro(reply, 'indisponivel');
    const bruto = request.cookies[COOKIE_OAUTH];
    reply.clearCookie(COOKIE_OAUTH, cookieBase);

    const assinado = bruto ? request.unsignCookie(bruto) : null;
    const verificacao = assinado?.valid
      ? esquemaVerificacao.safeParse(lerJson(assinado.value))
      : null;
    const query = new URLSearchParams(request.query as Record<string, string>);
    if (!verificacao?.success || query.get('state') !== verificacao.data.state) {
      request.log.warn('login: verificação OAuth ausente ou inválida');
      return voltarComErro(reply, 'falha');
    }

    const urlRetorno = new URL(urlRetornoGoogle);
    urlRetorno.search = query.toString();
    let identidade;
    try {
      identidade = await auth.identidade.concluir(urlRetorno, verificacao.data);
    } catch (erro) {
      request.log.warn({ err: erro }, 'login: falha ao concluir com o Google');
      return voltarComErro(reply, 'falha');
    }

    const usuarios = identidade.emailVerificado
      ? await app.deps.prisma.usuario.findMany({
          where: { email: identidade.email.trim().toLowerCase(), ativo: true },
        })
      : [];
    const usuario = usuarios.length === 1 ? usuarios[0] : undefined;
    if (!usuario) {
      request.log.warn({ encontrados: usuarios.length }, 'login: e-mail não autorizado');
      return voltarComErro(reply, 'nao-autorizado');
    }

    const { token, expiraEm } = await criarSessao(
      app.deps.prisma,
      usuario,
      app.deps.relogio.agora(),
      auth.duracaoSessaoHoras,
    );
    await registrarAuditoria(app.deps.prisma, {
      agenciaId: usuario.agenciaId,
      ator: `usuario:${usuario.id}`,
      acao: 'login',
      entidade: 'Usuario',
      entidadeId: usuario.id,
    });
    reply.setCookie(COOKIE_SESSAO, token, { ...cookieBase, expires: expiraEm });
    return reply.redirect(`${auth.urlApp}/`, 303);
  });

  app.post('/auth/sair', async (request, reply) => {
    const token = request.cookies[COOKIE_SESSAO];
    if (token) {
      const { count } = await app.deps.prisma.sessao.deleteMany({
        where: { id: hashToken(token) },
      });
      if (count > 0 && request.usuario) {
        await registrarAuditoria(app.deps.prisma, {
          agenciaId: request.usuario.agenciaId,
          ator: `usuario:${request.usuario.id}`,
          acao: 'logout',
          entidade: 'Usuario',
          entidadeId: request.usuario.id,
        });
      }
    }
    reply.clearCookie(COOKIE_SESSAO, cookieBase);
    return reply.redirect(`${auth.urlApp}/entrar`, 303);
  });

  app.get('/auth/eu', { preHandler: exigirUsuario }, (request) => {
    const { id, nome, email, papel } = usuarioDaRequisicao(request);
    return { id, nome, email, papel };
  });
}
