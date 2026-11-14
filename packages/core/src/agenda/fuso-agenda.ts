import { minutosDoDia } from './janelas.js';

const MS_POR_MINUTO = 60 * 1000;
const MS_POR_DIA = 24 * 60 * MS_POR_MINUTO;

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fuso: string): Intl.DateTimeFormat {
  const guardado = formatadores.get(fuso);
  if (guardado) return guardado;
  try {
    const novo = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatadores.set(fuso, novo);
    return novo;
  } catch {
    throw new Error(`Fuso inválido: ${fuso}`);
  }
}

interface PartesLocais {
  readonly ano: string;
  readonly mes: string;
  readonly dia: string;
  readonly hora: string;
  readonly minuto: string;
  readonly segundo: string;
}

function partesLocais(instante: Date, fuso: string): PartesLocais {
  const partes = Object.fromEntries(
    formatador(fuso)
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  return {
    ano: String(partes['year']),
    mes: String(partes['month']),
    dia: String(partes['day']),
    hora: String(partes['hour']),
    minuto: String(partes['minute']),
    segundo: String(partes['second']),
  };
}

/** Quanto o relógio do fuso está adiantado em relação a UTC naquele instante, em milissegundos. */
function deslocamentoMs(instanteMs: number, fuso: string): number {
  const p = partesLocais(new Date(instanteMs), fuso);
  const relogioLocal = Date.UTC(
    Number(p.ano),
    Number(p.mes) - 1,
    Number(p.dia),
    Number(p.hora),
    Number(p.minuto),
    Number(p.segundo),
  );
  return relogioLocal - Math.floor(instanteMs / 1000) * 1000;
}

/** Data (`YYYY-MM-DD`) que o relógio do fuso marca naquele instante (RN-32). */
export function dataLocal(instante: Date, fuso: string): string {
  const p = partesLocais(instante, fuso);
  return `${p.ano}-${p.mes}-${p.dia}`;
}

/** Hora (`HH:mm`) que o relógio do fuso marca naquele instante (RN-32). */
export function horaLocal(instante: Date, fuso: string): string {
  const p = partesLocais(instante, fuso);
  return `${p.hora}:${p.minuto}`;
}

/**
 * Instante UTC em que o relógio do fuso marca `data` e `hora` (RN-32). Devolve `null` se esse
 * horário não existe no fuso (o que pula na virada para o horário de verão). Se acontece duas
 * vezes (virada de volta), vale a primeira. O JavaScript não faz esta conta sozinho, então ela
 * testa os dois deslocamentos possíveis em volta da data e confere qual bate com o relógio local.
 */
export function instanteLocal(data: string, hora: string, fuso: string): Date | null {
  const minutos = minutosDoDia(hora);
  const [ano, mes, dia] = data.split('-').map(Number);
  if (minutos === null || ano === undefined || mes === undefined || dia === undefined) {
    throw new Error(`Data ou hora inválida: ${data} ${hora}`);
  }
  const relogio = Date.UTC(ano, mes - 1, dia) + minutos * MS_POR_MINUTO;
  const candidatos = new Set([
    relogio - deslocamentoMs(relogio - MS_POR_DIA, fuso),
    relogio - deslocamentoMs(relogio + MS_POR_DIA, fuso),
  ]);
  const validos = [...candidatos].filter((c) => c + deslocamentoMs(c, fuso) === relogio);
  const primeiro = Math.min(...validos);
  return validos.length === 0 ? null : new Date(primeiro);
}
