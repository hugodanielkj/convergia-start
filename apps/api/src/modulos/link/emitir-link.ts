import { NaoEncontradoError } from '@convergia/core/base';
import { calcularExpiracao, gerarTokenLink } from '@convergia/core/link';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

/** Rota da página do cliente (apps/web/app/o/[token]). */
const CAMINHO_PAGINA_CLIENTE = '/o';

/** O que a agência recebe ao emitir um link. O token só aparece aqui, nunca mais (D-13). */
export interface LinkEmitido {
  readonly token: string;
  readonly caminho: string;
  readonly expiraEm: Date;
}

/** Dados que vão para o banco: só o hash, nunca o token. */
export interface DadosLink {
  readonly agenciaId: string;
  readonly tokenHash: string;
  readonly expiraEm: Date;
}

export interface LinkPreparado {
  readonly emitido: LinkEmitido;
  readonly dados: DadosLink;
}

/**
 * Gera um token novo com a validade configurada pela agência (RN-10, RN-11, `validadeLinkDias`).
 * Só prepara: quem chama grava `dados` na mesma transação que cria ou atualiza o onboarding.
 */
export async function prepararLink(
  prisma: PrismaDaAgencia,
  agenciaId: string,
  agora: Date,
): Promise<LinkPreparado> {
  const config = await prisma.configAgencia.findFirst({ select: { validadeLinkDias: true } });
  if (!config) throw new NaoEncontradoError('Configuração da agência');

  const { token, hash } = gerarTokenLink();
  const expiraEm = calcularExpiracao(agora, config.validadeLinkDias);
  return {
    emitido: { token, caminho: `${CAMINHO_PAGINA_CLIENTE}/${token}`, expiraEm },
    dados: { agenciaId, tokenHash: hash, expiraEm },
  };
}
