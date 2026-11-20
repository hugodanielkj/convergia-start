import { normalizarEmail } from '../clientes/email.js';
import type { StatusOnboarding } from '../onboarding/index.js';

/** Equipe da agência (S8-1): cadastro, papel e desativação feitos pelo Admin (RN-03). */

export const LIMITES_PESSOA = { nomeMax: 80 } as const;

export type ResultadoPessoa =
  | { readonly ok: true; readonly nome: string; readonly email: string }
  | { readonly ok: false; readonly erro: 'nome_invalido' | 'email_invalido' };

/** Valida nome e e-mail Google. O e-mail vai para minúsculas, como o login compara (D-21). */
export function validarPessoa(entrada: { nome: string; email: string }): ResultadoPessoa {
  const nome = entrada.nome.trim();
  if (nome === '' || nome.length > LIMITES_PESSOA.nomeMax)
    return { ok: false, erro: 'nome_invalido' };
  const email = normalizarEmail(entrada.email);
  if (!email.ok) return { ok: false, erro: 'email_invalido' };
  return { ok: true, nome, email: email.email };
}

/**
 * O Admin não desativa nem rebaixa a si mesmo. Como só um Admin ativo faz essas ações,
 * isso basta para a agência nunca ficar sem Admin ativo.
 */
export function validarAlteracaoPropria(atorId: string, alvoId: string): 'propria_conta' | null {
  return atorId === alvoId ? 'propria_conta' : null;
}

/** Onboardings que mudam de responsável quando alguém sai: todos menos os encerrados. */
export function emAndamento(status: StatusOnboarding): boolean {
  return status !== 'concluido' && status !== 'cancelado';
}
