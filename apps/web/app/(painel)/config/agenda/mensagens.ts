// Textos da tela de agenda. As regras (core) devolvem só códigos; o que o usuário lê fica aqui.

const DIAS_DA_SEMANA = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

/** Ordem em que a agência pensa a semana: segunda a domingo. */
export const ORDEM_DA_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const;

export const rotuloDia = (dia: number): string => DIAS_DA_SEMANA[dia] ?? String(dia);

interface JanelaOrdenavel {
  readonly tipo: string;
  readonly diaSemana: number;
  readonly horaInicio: string;
}

const posicaoNaSemana = (dia: number): number => ORDEM_DA_SEMANA.findIndex((d) => d === dia);

/** Reunião antes de captação, depois segunda a domingo, depois pela hora de início. */
export function compararJanelas(a: JanelaOrdenavel, b: JanelaOrdenavel): number {
  if (a.tipo !== b.tipo) return a.tipo === 'reuniao' ? -1 : 1;
  const porDia = posicaoNaSemana(a.diaSemana) - posicaoNaSemana(b.diaSemana);
  return porDia !== 0 ? porDia : a.horaInicio.localeCompare(b.horaInicio);
}

export const rotuloTipo = (tipo: string): string =>
  tipo === 'reuniao' ? 'Reunião' : tipo === 'captacao' ? 'Captação' : tipo;

const ERROS: Readonly<Record<string, string>> = {
  dia_invalido: 'Escolha um dia da semana.',
  hora_invalida: 'Informe a hora no formato 09:00.',
  intervalo_invalido: 'O fim precisa ser depois do início.',
  duracao_invalida: 'A duração precisa ser em minutos e caber dentro da janela.',
  sobreposicao: 'Já existe uma janela neste dia e tipo que se sobrepõe a este horário.',
  data_invalida: 'Informe datas válidas.',
  motivo_obrigatorio: 'Informe o motivo do bloqueio.',
  motivo_invalido: 'O motivo é longo demais.',
};

export const mensagemDeErro = (codigo: string): string => ERROS[codigo] ?? 'Valor inválido.';

/** `2026-11-15` vira `15/11/2026`. É só reordenar o texto: datas de calendário não têm fuso. */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

/** `2026-11-10` a `2026-11-10` vira um dia só; senão `28/12/2026 a 02/01/2027`. */
export function formatarPeriodo(inicio: string, fim: string): string {
  return inicio === fim ? formatarData(inicio) : `${formatarData(inicio)} a ${formatarData(fim)}`;
}
