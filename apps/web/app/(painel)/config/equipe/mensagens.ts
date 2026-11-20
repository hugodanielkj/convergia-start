/** Pessoa da equipe como a API devolve em GET /equipe. */
export interface PessoaEquipe {
  id: string;
  nome: string;
  email: string;
  papel: 'admin' | 'membro';
  ativo: boolean;
  emAndamento: number;
}

export const rotuloPapel = (papel: PessoaEquipe['papel']): string =>
  papel === 'admin' ? 'Administrador' : 'Membro';

const POR_CODIGO: Readonly<Record<string, string>> = {
  nome_invalido: 'Informe o nome, com até 80 letras.',
  email_invalido: 'Confira o e-mail.',
};

/** Traduz a resposta de erro da API no texto que a tela mostra. */
export function mensagemDoErro(status: number, corpo: unknown): string {
  if (status === 409) return 'Este e-mail já está cadastrado.';
  if (status === 403) return 'Só o administrador da agência altera a equipe.';
  const mensagem =
    typeof corpo === 'object' && corpo !== null && 'mensagem' in corpo ? corpo.mensagem : null;
  if (typeof mensagem !== 'string') return 'Não foi possível salvar. Tente de novo.';
  return POR_CODIGO[mensagem] ?? (status === 422 ? `${mensagem}.` : 'Confira os dados.');
}

/** "1 onboarding em andamento", "3 onboardings em andamento". */
export const textoEmAndamento = (n: number): string =>
  `${String(n)} ${n === 1 ? 'onboarding' : 'onboardings'} em andamento`;
