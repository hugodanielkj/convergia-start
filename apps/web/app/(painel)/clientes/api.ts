import { z } from 'zod';

// Respostas da API de clientes e onboarding (apps/api/src/modulos). Validadas aqui porque a
// web não confia no formato que chega pela rede.
const esquemaEtapa = z.object({ tipo: z.string(), status: z.string() });
const esquemaOnboarding = z.object({
  id: z.string(),
  responsavelId: z.string(),
  statusGeral: z.string(),
  etapas: z.array(esquemaEtapa),
  criadoEm: z.string(),
});
const esquemaCliente = z.object({
  id: z.string(),
  nomeEmpresa: z.string(),
  nomeContato: z.string(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  criadoEm: z.string(),
  onboarding: esquemaOnboarding.nullable(),
});
const esquemaLink = z.object({ token: z.string(), caminho: z.string(), expiraEm: z.string() });
const esquemaErroCampo = z.object({ campo: z.string(), codigo: z.string() });
const esquemaDuplicidade = z.object({
  nomeEmpresa: z.string(),
  motivos: z.array(z.enum(['whatsapp', 'email'])),
});

export type ClienteVisao = z.infer<typeof esquemaCliente>;
export type LinkVisao = z.infer<typeof esquemaLink>;
export type ErroCampo = z.infer<typeof esquemaErroCampo>;
export type DuplicidadeVisao = z.infer<typeof esquemaDuplicidade>;

export interface DadosCadastro {
  readonly nomeEmpresa: string;
  readonly nomeContato: string;
  readonly whatsapp: string;
  readonly email: string;
  readonly confirmarDuplicidade: boolean;
  /** RN-09: marcado, o convite não sai no cadastro. */
  readonly enviarConviteDepois: boolean;
  /** RN-08: escolhido pelo Admin; ausente = o Admin. */
  readonly responsavelId?: string;
}

export type ResultadoCadastro =
  | {
      readonly tipo: 'criado';
      readonly cliente: ClienteVisao;
      readonly link: LinkVisao;
      /** Convite na fila (RN-09) e quando ele sai (RN-59); `null` = "enviar convite depois". */
      readonly convite: { readonly enviaEm: string } | null;
    }
  | { readonly tipo: 'invalido'; readonly erros: readonly ErroCampo[] }
  | { readonly tipo: 'duplicado'; readonly duplicidades: readonly DuplicidadeVisao[] }
  | { readonly tipo: 'falha'; readonly mensagem: string };

export type ResultadoLink =
  | { readonly tipo: 'gerado'; readonly link: LinkVisao }
  | { readonly tipo: 'falha'; readonly mensagem: string };

export interface ClienteApi {
  listar(): Promise<ClienteVisao[]>;
  cadastrar(dados: DadosCadastro): Promise<ResultadoCadastro>;
  regenerarLink(onboardingId: string): Promise<ResultadoLink>;
}

/** Erro inesperado da API (rede, 5xx ou resposta fora do formato). */
export class ErroApi extends Error {
  override readonly name = 'ErroApi';
}

export interface OpcoesClienteApi {
  readonly baseUrl: string;
  readonly fetcher: typeof fetch;
  /** Cabeçalhos repassados à API, como o cookie de sessão do navegador. */
  readonly cabecalhos?: Readonly<Record<string, string>>;
}

export function criarClienteApi({
  baseUrl,
  fetcher,
  cabecalhos = {},
}: OpcoesClienteApi): ClienteApi {
  async function chamar(caminho: string, init: { method: string; corpo?: unknown }) {
    const resposta = await fetcher(`${baseUrl}${caminho}`, {
      method: init.method,
      cache: 'no-store',
      headers: {
        ...cabecalhos,
        ...(init.corpo === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(init.corpo === undefined ? {} : { body: JSON.stringify(init.corpo) }),
    });
    return { status: resposta.status, json: (await resposta.json().catch(() => null)) as unknown };
  }

  return {
    async listar() {
      const { status, json } = await chamar('/clientes', { method: 'GET' });
      if (status !== 200) throw new ErroApi(`Listagem de clientes falhou (${String(status)})`);
      return lerResposta(z.object({ clientes: z.array(esquemaCliente) }), json).clientes;
    },

    async cadastrar(dados) {
      const { status, json } = await chamar('/clientes', { method: 'POST', corpo: dados });
      switch (status) {
        case 201:
          return {
            tipo: 'criado',
            ...lerResposta(
              z.object({
                cliente: esquemaCliente,
                link: esquemaLink,
                convite: z.object({ enviaEm: z.string() }).nullable().default(null),
              }),
              json,
            ),
          };
        case 409:
          return {
            tipo: 'duplicado',
            duplicidades: lerResposta(z.object({ duplicidades: z.array(esquemaDuplicidade) }), json)
              .duplicidades,
          };
        case 422:
          return {
            tipo: 'invalido',
            erros: lerResposta(z.object({ erros: z.array(esquemaErroCampo) }), json).erros,
          };
        case 400:
          return {
            tipo: 'falha',
            mensagem: 'Os dados enviados não foram aceitos. Confira os campos.',
          };
        case 401:
        case 403:
          return { tipo: 'falha', mensagem: 'Você não tem permissão para esta ação.' };
        default:
          throw new ErroApi(`Cadastro de cliente falhou (${String(status)})`);
      }
    },

    async regenerarLink(onboardingId) {
      const caminho = `/onboardings/${encodeURIComponent(onboardingId)}/link/regenerar`;
      const { status, json } = await chamar(caminho, { method: 'POST' });
      switch (status) {
        case 200:
          return { tipo: 'gerado', link: lerResposta(z.object({ link: esquemaLink }), json).link };
        case 401:
        case 403:
          return {
            tipo: 'falha',
            mensagem: 'Só o Admin ou o responsável pelo onboarding pode gerar um novo link.',
          };
        case 404:
          return { tipo: 'falha', mensagem: 'Onboarding não encontrado.' };
        case 422:
          return {
            tipo: 'falha',
            mensagem: 'Este onboarding já foi encerrado e não tem link ativo.',
          };
        default:
          throw new ErroApi(`Regeneração do link falhou (${String(status)})`);
      }
    },
  };
}

function lerResposta<T extends z.ZodType>(esquema: T, json: unknown): z.infer<T> {
  const resultado = esquema.safeParse(json);
  if (!resultado.success) throw new ErroApi('Resposta da API fora do formato esperado');
  return resultado.data;
}
