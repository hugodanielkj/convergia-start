/** Dados do evento no calendário da agência (RN-34). */
export interface EventoCalendario {
  readonly titulo: string;
  readonly descricao?: string | undefined;
  readonly inicio: Date;
  readonly fim: Date;
  /** E-mails que recebem o convite (o cliente, RN-34). */
  readonly convidados: readonly string[];
  /** Gera o link de videochamada do Google Meet (reunião online, D-03). */
  readonly comVideochamada: boolean;
}

export interface EventoCriado {
  /** Identificador do evento no calendário, guardado em `evento_externo_id`. */
  readonly id: string;
  readonly linkVideochamada?: string | undefined;
}

/**
 * Porta do calendário (D-12, RN-71): o resto do sistema só conhece esta interface. A implementação
 * do Google Calendar fica em `apps/api/src/adapters/calendario`; os testes usam uma em memória.
 */
export interface Calendario {
  criarEvento(evento: EventoCalendario): Promise<EventoCriado>;
  atualizarEvento(id: string, evento: EventoCalendario): Promise<void>;
  cancelarEvento(id: string): Promise<void>;
}

/** Falha ao falar com o calendário. `transitoria` diz se vale tentar de novo (rede, 5xx, limite de uso). */
export class FalhaCalendarioError extends Error {
  override readonly name = 'FalhaCalendarioError';

  constructor(
    mensagem: string,
    readonly transitoria: boolean,
  ) {
    super(mensagem);
  }
}

/**
 * Esperas, em minutos, antes de cada nova tentativa. É política técnica da integração (RN-67), não
 * prazo de negócio da agência, por isso não vem da configuração.
 */
export const ESPERAS_ENTRE_TENTATIVAS_MIN: readonly number[] = [1, 5, 15, 60, 360];

/** Quantas retentativas vêm depois da primeira falha; passando disso, desiste e avisa a agência. */
export const MAX_TENTATIVAS = ESPERAS_ENTRE_TENTATIVAS_MIN.length;

const MS_POR_MINUTO = 60 * 1000;

export type DecisaoDepoisDaFalha =
  { readonly tipo: 'tentar_de_novo'; readonly em: Date } | { readonly tipo: 'desistir' };

/**
 * O que fazer depois de uma falha de sincronização (RN-67). O agendamento interno nunca é
 * desfeito: só o `evento_externo_id` fica pendente e a tentativa é repetida com espera crescente.
 */
export function decidirDepoisDeFalha(entrada: {
  readonly tentativasFeitas: number;
  readonly transitoria: boolean;
  readonly agora: Date;
}): DecisaoDepoisDaFalha {
  const espera = ESPERAS_ENTRE_TENTATIVAS_MIN[entrada.tentativasFeitas];
  if (!entrada.transitoria || espera === undefined) return { tipo: 'desistir' };
  return { tipo: 'tentar_de_novo', em: new Date(entrada.agora.getTime() + espera * MS_POR_MINUTO) };
}
