/** Etapas do onboarding, na ordem em que o cliente as vê (RN-06). */
export const ETAPAS_ONBOARDING = ['formulario', 'acessos', 'reuniao', 'captacao'] as const;
export type TipoEtapa = (typeof ETAPAS_ONBOARDING)[number];

/** Estados de uma etapa (seção 7 da spec). As transições ficam com a máquina de estados (S4-1). */
export type StatusEtapa = 'pendente' | 'em_andamento' | 'concluida' | 'bloqueada';

/** Status geral do onboarding, na ordem da jornada seguido dos laterais (RN-49). */
export const STATUS_ONBOARDING = [
  'criado',
  'convite_enviado',
  'em_andamento',
  'aguardando_agendamentos',
  'aguardando_reuniao',
  'aguardando_captacao',
  'em_producao',
  'primeiro_conteudo_entregue',
  'concluido',
  'pausado',
  'cancelado',
] as const;
export type StatusOnboarding = (typeof STATUS_ONBOARDING)[number];

export interface EtapaInicial {
  readonly tipo: TipoEtapa;
  readonly status: 'pendente';
}

/** As quatro etapas de um onboarding novo, todas pendentes (RN-06). */
export function criarEtapasIniciais(): EtapaInicial[] {
  return ETAPAS_ONBOARDING.map((tipo) => ({ tipo, status: 'pendente' }));
}

const STATUS_ENCERRADOS: ReadonlySet<StatusOnboarding> = new Set(['concluido', 'cancelado']);

/**
 * Onboarding ativo é o que ainda não terminou nem foi cancelado (RN-07). Pausado conta como ativo:
 * o cliente só pode ter um onboarding em andamento por vez, e pausar não libera outro.
 */
export function onboardingAtivo(status: StatusOnboarding): boolean {
  return !STATUS_ENCERRADOS.has(status);
}
