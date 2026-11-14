import type { AgendaApi, DadosJanela, ResultadoGravacao } from './api';
import { mensagemDeErro, rotuloDia } from './mensagens';

export interface ValoresJanela {
  readonly tipo: string;
  readonly dias: readonly string[];
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos: string;
}

export interface ValoresBloqueio {
  readonly dataInicio: string;
  readonly dataFim: string;
  readonly motivo: string;
}

export type EstadoJanela =
  | { readonly tipo: 'inicial' }
  | { readonly tipo: 'salva'; readonly quantidade: number }
  | { readonly tipo: 'erro'; readonly valores: ValoresJanela; readonly mensagem: string };

export type EstadoBloqueio =
  | { readonly tipo: 'inicial' }
  | { readonly tipo: 'salvo' }
  | { readonly tipo: 'erro'; readonly valores: ValoresBloqueio; readonly mensagem: string };

export type EstadoRemocao =
  { readonly tipo: 'inicial' } | { readonly tipo: 'erro'; readonly mensagem: string };

const FALHA_DE_REDE = 'Não foi possível falar com o servidor. Tente de novo em instantes.';

const texto = (dados: FormData, campo: string): string => {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor : '';
};

export function lerValoresJanela(dados: FormData): ValoresJanela {
  return {
    tipo: texto(dados, 'tipo'),
    dias: dados.getAll('diaSemana').filter((d): d is string => typeof d === 'string'),
    horaInicio: texto(dados, 'horaInicio'),
    horaFim: texto(dados, 'horaFim'),
    duracaoMinutos: texto(dados, 'duracaoMinutos').trim(),
  };
}

function mensagemDaGravacao(resultado: Exclude<ResultadoGravacao, { tipo: 'ok' }>): string {
  return resultado.tipo === 'recusado' ? mensagemDeErro(resultado.codigo) : resultado.mensagem;
}

/**
 * Cria a janela para cada dia marcado (segunda a sexta com o mesmo horário, por exemplo). Para no
 * primeiro erro e diz em qual dia; os dias anteriores já ficaram gravados.
 */
export async function processarJanela(dados: FormData, api: AgendaApi): Promise<EstadoJanela> {
  const valores = lerValoresJanela(dados);
  if (valores.tipo !== 'reuniao' && valores.tipo !== 'captacao') {
    return { tipo: 'erro', valores, mensagem: 'Escolha reunião ou captação.' };
  }
  if (valores.dias.length === 0) {
    return { tipo: 'erro', valores, mensagem: mensagemDeErro('dia_invalido') };
  }

  const duracao = valores.duracaoMinutos === '' ? undefined : Number(valores.duracaoMinutos);
  let salvas = 0;
  try {
    for (const dia of valores.dias) {
      const janela: DadosJanela = {
        tipo: valores.tipo,
        diaSemana: Number(dia),
        horaInicio: valores.horaInicio,
        horaFim: valores.horaFim,
        ...(duracao === undefined ? {} : { duracaoMinutos: duracao }),
      };
      const resultado = await api.criarJanela(janela);
      if (resultado.tipo !== 'ok') {
        const onde = `${rotuloDia(Number(dia))}: ${mensagemDaGravacao(resultado)}`;
        const parcial =
          salvas > 0 ? ` (${String(salvas)} dia(s) anterior(es) já foram salvos)` : '';
        return { tipo: 'erro', valores, mensagem: `${onde}${parcial}` };
      }
      salvas += 1;
    }
  } catch {
    return { tipo: 'erro', valores, mensagem: FALHA_DE_REDE };
  }
  return { tipo: 'salva', quantidade: salvas };
}

export async function processarBloqueio(dados: FormData, api: AgendaApi): Promise<EstadoBloqueio> {
  const valores: ValoresBloqueio = {
    dataInicio: texto(dados, 'dataInicio'),
    dataFim: texto(dados, 'dataFim') || texto(dados, 'dataInicio'),
    motivo: texto(dados, 'motivo'),
  };
  try {
    const resultado = await api.criarBloqueio(valores);
    return resultado.tipo === 'ok'
      ? { tipo: 'salvo' }
      : { tipo: 'erro', valores, mensagem: mensagemDaGravacao(resultado) };
  } catch {
    return { tipo: 'erro', valores, mensagem: FALHA_DE_REDE };
  }
}

/** Remove uma janela ou um bloqueio, conforme o campo `alvo` do formulário. */
export async function processarRemocao(dados: FormData, api: AgendaApi): Promise<EstadoRemocao> {
  const id = texto(dados, 'id');
  const alvo = texto(dados, 'alvo');
  if (id === '' || (alvo !== 'janela' && alvo !== 'bloqueio')) {
    return { tipo: 'erro', mensagem: 'Item não informado.' };
  }
  try {
    const resultado = await (alvo === 'janela' ? api.removerJanela(id) : api.removerBloqueio(id));
    return resultado.tipo === 'ok'
      ? { tipo: 'inicial' }
      : { tipo: 'erro', mensagem: mensagemDaGravacao(resultado) };
  } catch {
    return { tipo: 'erro', mensagem: FALHA_DE_REDE };
  }
}
