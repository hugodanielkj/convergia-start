import { RegraVioladaError } from '../base/erros.js';
import type { StatusOnboarding } from '../onboarding/index.js';

const LATERAIS = ['pausado', 'cancelado'] as const;

/**
 * Antes da captação realizada, o status anda para frente e para trás conforme as etapas: reabrir o
 * formulário ou cancelar um agendamento devolve o onboarding a um status anterior (RN-54).
 */
const ANTES_DA_PRODUCAO: readonly StatusOnboarding[] = [
  'em_andamento',
  'aguardando_agendamentos',
  'aguardando_reuniao',
  'aguardando_captacao',
  'em_producao',
];

/** Status da jornada para onde o onboarding pode voltar ao sair da pausa (RN-53). */
const DESTINOS_DA_RETOMADA: readonly StatusOnboarding[] = [
  'criado',
  'convite_enviado',
  ...ANTES_DA_PRODUCAO,
  'primeiro_conteudo_entregue',
];

const semProprio = (lista: readonly StatusOnboarding[], s: StatusOnboarding) =>
  lista.filter((d) => d !== s);

/** Mapa de transições do status geral (RN-49, seção 7). O que não está aqui é rejeitado. */
const TRANSICOES: Record<StatusOnboarding, readonly StatusOnboarding[]> = {
  criado: ['convite_enviado', ...ANTES_DA_PRODUCAO, ...LATERAIS],
  convite_enviado: [...ANTES_DA_PRODUCAO, ...LATERAIS],
  em_andamento: [...semProprio(ANTES_DA_PRODUCAO, 'em_andamento'), ...LATERAIS],
  aguardando_agendamentos: [
    ...semProprio(ANTES_DA_PRODUCAO, 'aguardando_agendamentos'),
    ...LATERAIS,
  ],
  aguardando_reuniao: [...semProprio(ANTES_DA_PRODUCAO, 'aguardando_reuniao'), ...LATERAIS],
  aguardando_captacao: [...semProprio(ANTES_DA_PRODUCAO, 'aguardando_captacao'), ...LATERAIS],
  em_producao: ['primeiro_conteudo_entregue', ...LATERAIS],
  primeiro_conteudo_entregue: ['concluido', ...LATERAIS],
  concluido: [],
  pausado: [...DESTINOS_DA_RETOMADA, 'cancelado'],
  cancelado: [],
};

export function transicaoPermitida(de: StatusOnboarding, para: StatusOnboarding): boolean {
  return TRANSICOES[de].includes(para);
}

/** Rejeita transição inválida (seção 7: "transições inválidas devem ser rejeitadas pelo backend"). */
export function garantirTransicao(de: StatusOnboarding, para: StatusOnboarding): void {
  if (!transicaoPermitida(de, para)) {
    throw new RegraVioladaError('RN-49', `O onboarding não pode passar de "${de}" para "${para}"`);
  }
}

const SEM_LEMBRETES: ReadonlySet<StatusOnboarding> = new Set(['pausado', 'cancelado', 'concluido']);

/** RN-53: lembretes cessam com o onboarding pausado, cancelado ou concluído. */
export function recebeLembretes(status: StatusOnboarding): boolean {
  return !SEM_LEMBRETES.has(status);
}
