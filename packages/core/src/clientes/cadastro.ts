import { normalizarEmail } from './email.js';
import { normalizarTelefone, type ErroTelefone } from './telefone.js';

export interface DadosCadastroCliente {
  readonly nomeEmpresa: string;
  readonly nomeContato: string;
  readonly whatsapp?: string | undefined;
  readonly email?: string | undefined;
}

/** Cliente com dados limpos: canais em E.164 e minúsculas, ou `null` quando não informados. */
export interface ClienteValidado {
  readonly nomeEmpresa: string;
  readonly nomeContato: string;
  readonly whatsapp: string | null;
  readonly email: string | null;
}

export type CampoCadastro = 'nomeEmpresa' | 'nomeContato' | 'whatsapp' | 'email' | 'contato';

export type CodigoErroCadastro =
  'obrigatorio' | 'contato_obrigatorio' | ErroTelefone | 'email_invalido';

/** Erro de um campo, com a regra violada. O texto exibido fica na apresentação. */
export interface ErroCadastro {
  readonly campo: CampoCadastro;
  readonly codigo: CodigoErroCadastro;
  readonly regra: 'RN-04' | 'RN-05';
}

export type ResultadoCadastro =
  | { readonly ok: true; readonly cliente: ClienteValidado }
  | { readonly ok: false; readonly erros: readonly ErroCadastro[] };

/**
 * Valida o cadastro de cliente (RN-04, RN-05) e devolve todos os erros de uma vez,
 * para o formulário marcar cada campo.
 */
export function validarCadastroCliente(dados: DadosCadastroCliente): ResultadoCadastro {
  const erros: ErroCadastro[] = [];
  const nomeEmpresa = limparNome(dados.nomeEmpresa);
  const nomeContato = limparNome(dados.nomeContato);
  if (nomeEmpresa === '')
    erros.push({ campo: 'nomeEmpresa', codigo: 'obrigatorio', regra: 'RN-04' });
  if (nomeContato === '')
    erros.push({ campo: 'nomeContato', codigo: 'obrigatorio', regra: 'RN-04' });

  const whatsappDigitado = dados.whatsapp?.trim() ?? '';
  const emailDigitado = dados.email?.trim() ?? '';
  if (whatsappDigitado === '' && emailDigitado === '') {
    erros.push({ campo: 'contato', codigo: 'contato_obrigatorio', regra: 'RN-04' });
  }

  let whatsapp: string | null = null;
  if (whatsappDigitado !== '') {
    const telefone = normalizarTelefone(whatsappDigitado);
    if (telefone.ok) whatsapp = telefone.e164;
    else erros.push({ campo: 'whatsapp', codigo: telefone.erro, regra: 'RN-05' });
  }

  let email: string | null = null;
  if (emailDigitado !== '') {
    const resultado = normalizarEmail(emailDigitado);
    if (resultado.ok) email = resultado.email;
    else erros.push({ campo: 'email', codigo: resultado.erro, regra: 'RN-05' });
  }

  if (erros.length > 0) return { ok: false, erros };
  return { ok: true, cliente: { nomeEmpresa, nomeContato, whatsapp, email } };
}

function limparNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}
