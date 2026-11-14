import { RegraVioladaError } from '../base/erros.js';
import { onboardingAtivo, type StatusOnboarding } from '../onboarding/index.js';

/**
 * RN-73: os dados de um cliente só são excluídos com todos os onboardings cancelados ou concluídos
 * (decisão 2026-11-14-a-lgpd-exportar-excluir). Pausado ainda é ativo.
 */
export function garantirExclusao(status: readonly StatusOnboarding[]): void {
  if (status.some(onboardingAtivo)) {
    throw new RegraVioladaError(
      'RN-73',
      'Cancele o onboarding antes de excluir os dados do cliente',
    );
  }
}

const normalizarNome = (texto: string): string =>
  texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

/** A exclusão é irreversível: quem pede confirma digitando o nome da empresa (RN-73). */
export function garantirConfirmacao(nomeEmpresa: string, digitado: string): void {
  const esperado = normalizarNome(nomeEmpresa);
  if (!esperado || normalizarNome(digitado) !== esperado) {
    throw new RegraVioladaError('RN-73', 'Digite o nome da empresa exatamente como cadastrado');
  }
}

const slug = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Nome do arquivo de exportação: empresa e data (UTC) da exportação. */
export function nomeArquivoExportacao(nomeEmpresa: string, agora: Date): string {
  const data = agora.toISOString().slice(0, 10);
  return `dados-${slug(nomeEmpresa) || 'cliente'}-${data}.json`;
}

export type TipoAtor = 'usuario' | 'cliente' | 'sistema';

/** Lê o `ator` gravado na auditoria: "usuario:<id>", "cliente:<onboardingId>" ou "sistema". */
export function interpretarAtor(ator: string): { tipo: TipoAtor; id: string | null } {
  const [tipo, id] = ator.split(':', 2);
  if ((tipo === 'usuario' || tipo === 'cliente') && id) return { tipo, id };
  return { tipo: 'sistema', id: null };
}
