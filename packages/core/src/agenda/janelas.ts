export interface JanelaDisponibilidade {
  /** 0 = domingo ... 6 = sábado. */
  readonly diaSemana: number;
  /** "HH:mm", no fuso da agência. */
  readonly horaInicio: string;
  readonly horaFim: string;
  /** Duração de cada atendimento; sem ela vale a da configuração da agência (RN-30). */
  readonly duracaoMinutos?: number | undefined;
}

export type ErroJanela =
  'dia_invalido' | 'hora_invalida' | 'intervalo_invalido' | 'duracao_invalida';

export type ResultadoJanela =
  { readonly ok: true } | { readonly ok: false; readonly erro: ErroJanela };

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutos desde a meia-noite, ou `null` se não for uma hora "HH:mm" válida. */
export function minutosDoDia(hora: string): number | null {
  const partes = HORA.exec(hora);
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : null;
}

/** Valida uma janela semanal de disponibilidade (RN-30). A janela não atravessa a meia-noite. */
export function validarJanela(janela: JanelaDisponibilidade): ResultadoJanela {
  if (!Number.isInteger(janela.diaSemana) || janela.diaSemana < 0 || janela.diaSemana > 6) {
    return { ok: false, erro: 'dia_invalido' };
  }
  const inicio = minutosDoDia(janela.horaInicio);
  const fim = minutosDoDia(janela.horaFim);
  if (inicio === null || fim === null) return { ok: false, erro: 'hora_invalida' };
  if (fim <= inicio) return { ok: false, erro: 'intervalo_invalido' };

  const { duracaoMinutos } = janela;
  if (duracaoMinutos !== undefined) {
    const cabe =
      Number.isInteger(duracaoMinutos) && duracaoMinutos > 0 && duracaoMinutos <= fim - inicio;
    if (!cabe) return { ok: false, erro: 'duracao_invalida' };
  }
  return { ok: true };
}

type Intervalo = Pick<JanelaDisponibilidade, 'diaSemana' | 'horaInicio' | 'horaFim'>;

/** Duas janelas do mesmo dia que se cruzam. Encostar (uma termina quando a outra começa) não conta. */
export function janelasSeSobrepoem(a: Intervalo, b: Intervalo): boolean {
  if (a.diaSemana !== b.diaSemana) return false;
  const aIni = minutosDoDia(a.horaInicio);
  const aFim = minutosDoDia(a.horaFim);
  const bIni = minutosDoDia(b.horaInicio);
  const bFim = minutosDoDia(b.horaFim);
  if (aIni === null || aFim === null || bIni === null || bFim === null) return false;
  return aIni < bFim && bIni < aFim;
}
