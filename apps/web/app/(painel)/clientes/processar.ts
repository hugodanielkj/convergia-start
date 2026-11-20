import type { ClienteApi, LinkVisao } from './api';
import { descreverMotivos, mensagemDeErroCampo } from './mensagens';

export interface Valores {
  readonly nomeEmpresa: string;
  readonly nomeContato: string;
  readonly whatsapp: string;
  readonly email: string;
  readonly enviarConviteDepois: boolean;
  /** RN-08: só o Admin vê o seletor; vazio = o Admin fica como responsável. */
  readonly responsavelId: string;
}

export type EstadoCadastro =
  | { readonly tipo: 'inicial' }
  | {
      readonly tipo: 'invalido';
      readonly valores: Valores;
      readonly erros: Readonly<Record<string, string>>;
    }
  | {
      readonly tipo: 'duplicado';
      readonly valores: Valores;
      /** Uma frase por cliente que coincide, já pronta para exibir (RN-07). */
      readonly avisos: readonly string[];
    }
  | { readonly tipo: 'falha'; readonly valores: Valores; readonly mensagem: string }
  | {
      readonly tipo: 'criado';
      readonly nomeEmpresa: string;
      readonly link: LinkVisao;
      readonly convite: { readonly enviaEm: string } | null;
      /** Algo da personalização (S6-2/S6-3) não foi salvo; o cliente já existe. */
      readonly aviso?: string;
    };

export type EstadoLink =
  | { readonly tipo: 'inicial' }
  | { readonly tipo: 'gerado'; readonly link: LinkVisao }
  | { readonly tipo: 'falha'; readonly mensagem: string };

const FALHA_DE_REDE = 'Não foi possível falar com o servidor. Tente de novo em instantes.';

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor : '';
}

export function lerValores(dados: FormData): Valores {
  return {
    nomeEmpresa: texto(dados, 'nomeEmpresa'),
    nomeContato: texto(dados, 'nomeContato'),
    whatsapp: texto(dados, 'whatsapp'),
    email: texto(dados, 'email'),
    enviarConviteDepois: texto(dados, 'enviarConviteDepois') === 'on',
    responsavelId: texto(dados, 'responsavelId'),
  };
}

/**
 * Envia o formulário de cadastro e traduz a resposta da API no que a tela mostra. O botão
 * "Cadastrar mesmo assim" reenvia o mesmo formulário com `confirmarDuplicidade=true` (RN-07).
 */
export async function processarCadastro(dados: FormData, api: ClienteApi): Promise<EstadoCadastro> {
  const valores = lerValores(dados);
  const { responsavelId, ...resto } = valores;
  try {
    const resultado = await api.cadastrar({
      ...resto,
      ...(responsavelId === '' ? {} : { responsavelId }),
      confirmarDuplicidade: texto(dados, 'confirmarDuplicidade') === 'true',
    });
    switch (resultado.tipo) {
      case 'criado':
        return {
          tipo: 'criado',
          nomeEmpresa: resultado.cliente.nomeEmpresa,
          link: resultado.link,
          convite: resultado.convite,
        };
      case 'invalido':
        return { tipo: 'invalido', valores, erros: primeiroErroPorCampo(resultado.erros) };
      case 'duplicado':
        return {
          tipo: 'duplicado',
          valores,
          avisos: resultado.duplicidades.map(
            (d) => `${d.nomeEmpresa} tem ${descreverMotivos(d.motivos)}.`,
          ),
        };
      case 'falha':
        return { tipo: 'falha', valores, mensagem: resultado.mensagem };
    }
  } catch {
    return { tipo: 'falha', valores, mensagem: FALHA_DE_REDE };
  }
}

function primeiroErroPorCampo(
  erros: readonly { campo: string; codigo: string }[],
): Record<string, string> {
  const porCampo: Record<string, string> = {};
  for (const { campo, codigo } of erros) porCampo[campo] ??= mensagemDeErroCampo(codigo);
  return porCampo;
}

/** Gera um link novo para o onboarding (RN-12); o anterior deixa de valer na hora. */
export async function processarNovoLink(dados: FormData, api: ClienteApi): Promise<EstadoLink> {
  const onboardingId = texto(dados, 'onboardingId');
  if (onboardingId === '') return { tipo: 'falha', mensagem: 'Onboarding não informado.' };
  try {
    const resultado = await api.regenerarLink(onboardingId);
    return resultado.tipo === 'gerado'
      ? { tipo: 'gerado', link: resultado.link }
      : { tipo: 'falha', mensagem: resultado.mensagem };
  } catch {
    return { tipo: 'falha', mensagem: FALHA_DE_REDE };
  }
}
