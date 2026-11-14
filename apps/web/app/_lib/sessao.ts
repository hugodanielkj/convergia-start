import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { URL_API } from './url-api';

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  papel: 'admin' | 'membro';
}

/**
 * Usuário logado, consultado na API com o cookie da requisição.
 * Sem sessão válida, manda para /entrar. Use em páginas e layouts do painel.
 */
export async function exigirSessao(): Promise<UsuarioSessao> {
  const resposta = await fetch(`${URL_API}/auth/eu`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (resposta.status === 401) redirect('/entrar');
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} em /auth/eu`);
  return (await resposta.json()) as UsuarioSessao;
}
