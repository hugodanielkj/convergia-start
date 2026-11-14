import { z } from 'zod';

// Respostas da API de agenda (apps/api/src/modulos/agenda), validadas porque a web não confia no
// formato que chega pela rede.
const esquemaJanela = z.object({
  id: z.string(),
  tipo: z.enum(['reuniao', 'captacao']),
  diaSemana: z.number(),
  horaInicio: z.string(),
  horaFim: z.string(),
  duracaoMinutos: z.number().nullable(),
  usuarioId: z.string().nullable(),
});
const esquemaBloqueio = z.object({
  id: z.string(),
  dataInicio: z.string(),
  dataFim: z.string(),
  motivo: z.string(),
});
const esquemaFeriado = z.object({ data: z.string(), nome: z.string() });
const esquemaCodigo = z.object({ codigo: z.string() });

export type JanelaVisao = z.infer<typeof esquemaJanela>;
export type BloqueioVisao = z.infer<typeof esquemaBloqueio>;
export type FeriadoVisao = z.infer<typeof esquemaFeriado>;

export interface DadosJanela {
  readonly tipo: 'reuniao' | 'captacao';
  readonly diaSemana: number;
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos?: number;
}

export interface DadosBloqueio {
  readonly dataInicio: string;
  readonly dataFim: string;
  readonly motivo: string;
}

/** Resultado de uma gravação: deu certo, os dados foram recusados (com o código) ou falhou. */
export type ResultadoGravacao =
  | { readonly tipo: 'ok' }
  | { readonly tipo: 'recusado'; readonly codigo: string }
  | { readonly tipo: 'falha'; readonly mensagem: string };

export interface AgendaApi {
  listarJanelas(): Promise<JanelaVisao[]>;
  listarBloqueios(): Promise<BloqueioVisao[]>;
  listarFeriados(): Promise<FeriadoVisao[]>;
  criarJanela(dados: DadosJanela): Promise<ResultadoGravacao>;
  removerJanela(id: string): Promise<ResultadoGravacao>;
  criarBloqueio(dados: DadosBloqueio): Promise<ResultadoGravacao>;
  removerBloqueio(id: string): Promise<ResultadoGravacao>;
}

export class ErroApi extends Error {
  override readonly name = 'ErroApi';
}

export interface OpcoesAgendaApi {
  readonly baseUrl: string;
  readonly fetcher: typeof fetch;
  /** Cabeçalhos repassados à API, como o cookie de sessão do navegador. */
  readonly cabecalhos?: Readonly<Record<string, string>>;
}

const SEM_PERMISSAO = 'Só o Admin pode alterar a agenda.';

export function criarAgendaApi({ baseUrl, fetcher, cabecalhos = {} }: OpcoesAgendaApi): AgendaApi {
  async function chamar(metodo: string, caminho: string, corpo?: unknown) {
    const resposta = await fetcher(`${baseUrl}${caminho}`, {
      method: metodo,
      cache: 'no-store',
      headers: {
        ...cabecalhos,
        ...(corpo === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    return { status: resposta.status, json: (await resposta.json().catch(() => null)) as unknown };
  }

  async function ler<T extends z.ZodType>(caminho: string, esquema: T): Promise<z.infer<T>> {
    const { status, json } = await chamar('GET', caminho);
    if (status !== 200) throw new ErroApi(`Consulta falhou (${String(status)}): ${caminho}`);
    const resultado = esquema.safeParse(json);
    if (!resultado.success) throw new ErroApi('Resposta da API fora do formato esperado');
    return resultado.data;
  }

  /** Traduz o status de uma gravação (POST ou DELETE) no que a tela precisa saber. */
  function resultado(status: number, json: unknown): ResultadoGravacao {
    if (status === 201 || status === 204) return { tipo: 'ok' };
    if (status === 401 || status === 403) return { tipo: 'falha', mensagem: SEM_PERMISSAO };
    if (status === 404)
      return { tipo: 'falha', mensagem: 'Este item não existe mais. Atualize a página.' };
    if (status === 400)
      return { tipo: 'falha', mensagem: 'Os dados enviados não foram aceitos. Confira os campos.' };
    if (status === 422) {
      const codigo = esquemaCodigo.safeParse(json);
      // Conflito com outra janela (RN-30) não traz `codigo`: vem como `erro: "RN-30"`.
      return { tipo: 'recusado', codigo: codigo.success ? codigo.data.codigo : 'sobreposicao' };
    }
    throw new ErroApi(`Gravação falhou (${String(status)})`);
  }

  return {
    listarJanelas: async () =>
      (
        await ler(
          '/agenda/disponibilidades',
          z.object({ disponibilidades: z.array(esquemaJanela) }),
        )
      ).disponibilidades,
    listarBloqueios: async () =>
      (await ler('/agenda/bloqueios', z.object({ bloqueios: z.array(esquemaBloqueio) }))).bloqueios,
    listarFeriados: async () =>
      (await ler('/agenda/feriados', z.object({ feriados: z.array(esquemaFeriado) }))).feriados,
    async criarJanela(dados) {
      const { status, json } = await chamar('POST', '/agenda/disponibilidades', dados);
      return resultado(status, json);
    },
    async removerJanela(id) {
      const { status, json } = await chamar(
        'DELETE',
        `/agenda/disponibilidades/${encodeURIComponent(id)}`,
      );
      return resultado(status, json);
    },
    async criarBloqueio(dados) {
      const { status, json } = await chamar('POST', '/agenda/bloqueios', dados);
      return resultado(status, json);
    },
    async removerBloqueio(id) {
      const { status, json } = await chamar(
        'DELETE',
        `/agenda/bloqueios/${encodeURIComponent(id)}`,
      );
      return resultado(status, json);
    },
  };
}
