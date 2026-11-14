import {
  NaoAutenticadoError,
  ProibidoError,
  podeAlterarConfiguracoes,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { escopoAgencia, type PrismaDaAgencia } from './escopo-agencia.js';
import type { PrismaClient } from './prisma.js';

/**
 * Descobre o usuário da requisição. Contrato entre a base e o login (S1-2):
 * a S1-2 fornece a implementação real (sessão do Google). Retorna null se não houver sessão.
 */
export type ResolvedorSessao = (request: FastifyRequest) => Promise<UsuarioAutenticado | null>;

declare module 'fastify' {
  interface FastifyRequest {
    usuario: UsuarioAutenticado | null;
  }
}

/** Identidade confirmada por um provedor externo (Google). */
export interface DadosIdentidade {
  email: string;
  emailVerificado: boolean;
  nome: string | null;
}

/** Verificações do fluxo OAuth (state, nonce e PKCE), guardadas em cookie assinado. */
export interface VerificacaoLogin {
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** Porta para o provedor de login. Implementação real: Google (modulos/auth); testes usam fake. */
export interface ProvedorIdentidade {
  urlAutorizacao(params: { state: string; nonce: string; codeChallenge: string }): Promise<URL>;
  concluir(urlRetorno: URL, verificacao: VerificacaoLogin): Promise<DadosIdentidade>;
}

export interface ConfigAuth {
  /** Assina cookies (verificação OAuth). */
  segredoCookie: string;
  /** Origem da web (ex.: http://localhost:3000). A API é servida em `${urlApp}/api`. */
  urlApp: string;
  duracaoSessaoHoras: number;
  /** null quando o Google não está configurado: o login responde "indisponível". */
  identidade: ProvedorIdentidade | null;
}

/** Sem login implementado: ninguém está autenticado. */
export const semSessao: ResolvedorSessao = () => Promise.resolve(null);

/**
 * Só em desenvolvimento, até a S1-2: toda requisição é do usuário com este e-mail.
 * `carregarEnv` impede o uso em produção.
 */
export function sessaoDeDesenvolvimento(prisma: PrismaClient, email: string): ResolvedorSessao {
  return async () => {
    const usuario = await prisma.usuario.findFirst({ where: { email, ativo: true } });
    return usuario && { ...usuario, papel: usuario.papel };
  };
}

/** Preenche `request.usuario` em toda requisição. */
export const pluginAuth = fp(
  (app: FastifyInstance) => {
    app.decorateRequest('usuario', null);
    app.addHook('onRequest', async (request) => {
      request.usuario = await app.deps.resolverSessao(request);
    });
  },
  { name: 'auth', dependencies: [] },
);

/** preHandler: exige usuário logado. */
export function exigirUsuario(request: FastifyRequest): Promise<void> {
  if (!request.usuario) throw new NaoAutenticadoError();
  return Promise.resolve();
}

/** preHandler: exige admin (RN-03). */
export function exigirAdmin(request: FastifyRequest): Promise<void> {
  if (!request.usuario) throw new NaoAutenticadoError();
  if (!podeAlterarConfiguracoes(request.usuario)) throw new ProibidoError('RN-03');
  return Promise.resolve();
}

/** Usuário da requisição; use depois de `exigirUsuario`. */
export function usuarioDaRequisicao(request: FastifyRequest): UsuarioAutenticado {
  if (!request.usuario) throw new NaoAutenticadoError();
  return request.usuario;
}

/** Prisma restrito à agência do usuário logado (RN-75). */
export function prismaDaRequisicao(app: FastifyInstance, request: FastifyRequest): PrismaDaAgencia {
  return escopoAgencia(app.deps.prisma, usuarioDaRequisicao(request).agenciaId);
}
