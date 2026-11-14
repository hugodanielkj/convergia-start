import type { Canal, ResultadoEnvio } from '../base/mensageria.js';

/**
 * Política de retentativa (RN-62): até 3 tentativas por canal, esperando 1 e 5 minutos entre elas.
 * Esgotado um canal, passa para o alternativo na hora (RN-60). Sem credencial em nenhum canal, a
 * mensagem fica pendente e é tentada de novo mais tarde, sem gastar tentativas.
 */
export const POLITICA_RETENTATIVA = {
  tentativasPorCanal: 3,
  esperasMinutos: [1, 5],
  esperaSemCredencialMinutos: 15,
} as const;

/** Erro que o roteador de mensageria devolve quando um canal ainda não tem credenciais. */
export const ERRO_CANAL_NAO_CONFIGURADO = 'canal_nao_configurado';

/** Lembrete obedece ao opt-out (RN-61); transacional (convite, confirmação) não. */
export type CategoriaNotificacao = 'lembrete' | 'transacional';

export interface EstadoEnvio {
  /** Posição do canal atual na ordem de canais da mensagem. */
  readonly indice: number;
  /** Tentativas já feitas no canal atual. */
  readonly tentativas: number;
  /** Canais que responderam "sem credencial" nesta rodada. */
  readonly semCredencial: readonly Canal[];
  /** Algum canal falhou de verdade (não por falta de credencial). */
  readonly houveFalha: boolean;
}

export const ESTADO_INICIAL: EstadoEnvio = {
  indice: 0,
  tentativas: 0,
  semCredencial: [],
  houveFalha: false,
};

export type PassoEnvio =
  | { acao: 'enviada'; canal: Canal; idExterno: string }
  | { acao: 'aguardar'; estado: EstadoEnvio; em: Date; erro: string }
  | { acao: 'trocar_canal'; estado: EstadoEnvio; erro: string }
  | { acao: 'falhou'; erro: string };

/** RN-60: o canal padrão da agência primeiro, depois o outro; só canais com contato. */
export function ordemDosCanais(
  contatos: { whatsapp: string | null; email: string | null },
  padrao: Canal,
): Canal[] {
  const ordem: Canal[] = padrao === 'whatsapp' ? ['whatsapp', 'email'] : ['email', 'whatsapp'];
  return ordem.filter((c) => Boolean(contatos[c]));
}

const MS_POR_MINUTO = 60_000;
const depoisDe = (agora: Date, minutos: number) =>
  new Date(agora.getTime() + minutos * MS_POR_MINUTO);

/** O que fazer depois de uma tentativa de envio no canal atual (RN-60, RN-62). */
export function proximoPasso(
  estado: EstadoEnvio,
  canais: readonly Canal[],
  resultado: ResultadoEnvio,
  agora: Date,
): PassoEnvio {
  const canal = canais[estado.indice];
  if (canal === undefined) return { acao: 'falhou', erro: 'sem_contato' };
  if (resultado.ok) return { acao: 'enviada', canal, idExterno: resultado.idExterno };

  const { erro } = resultado;
  const ultimo = estado.indice >= canais.length - 1;

  if (erro === ERRO_CANAL_NAO_CONFIGURADO) {
    const semCredencial = [...estado.semCredencial, canal];
    if (!ultimo) {
      return {
        acao: 'trocar_canal',
        estado: { ...estado, indice: estado.indice + 1, tentativas: 0, semCredencial },
        erro,
      };
    }
    if (estado.houveFalha) return { acao: 'falhou', erro };
    return {
      acao: 'aguardar',
      estado: ESTADO_INICIAL,
      em: depoisDe(agora, POLITICA_RETENTATIVA.esperaSemCredencialMinutos),
      erro,
    };
  }

  const tentativas = estado.tentativas + 1;
  const espera = POLITICA_RETENTATIVA.esperasMinutos[tentativas - 1];
  if (
    resultado.temporario &&
    tentativas < POLITICA_RETENTATIVA.tentativasPorCanal &&
    espera !== undefined
  ) {
    return {
      acao: 'aguardar',
      estado: { ...estado, tentativas },
      em: depoisDe(agora, espera),
      erro,
    };
  }
  if (ultimo) return { acao: 'falhou', erro };
  return {
    acao: 'trocar_canal',
    estado: { ...estado, indice: estado.indice + 1, tentativas: 0, houveFalha: true },
    erro,
  };
}

/** RN-61: quem pediu para parar não recebe lembretes; convite e confirmações continuam. */
export function bloqueadaPorOptOut(categoria: CategoriaNotificacao, optOut: boolean): boolean {
  return categoria === 'lembrete' && optOut;
}

/** RN-61: todo lembrete termina com o link para parar de recebê-los. */
export function comRodapeOptOut(corpo: string, urlParar: string): string {
  return `${corpo}\n\nPara não receber mais lembretes: ${urlParar}`;
}

/** Número em E.164 (+5531...) no formato de contato que o provedor de WhatsApp espera. */
export function destinoNoWhatsapp(e164: string): string {
  return `${e164.replace(/\D/g, '')}@s.whatsapp.net`;
}
