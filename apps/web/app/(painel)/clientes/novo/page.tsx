import { cookies } from 'next/headers';
import { exigirSessao } from '../../../_lib/sessao';
import { URL_API } from '../../../_lib/url-api';
import type { Campo } from '../../config/formulario/tipos';
import { SecaoAcessosCadastro } from '../../onboardings/[id]/personalizar/SecaoAcessosCadastro';
import { SecaoPerguntasCadastro } from '../../onboardings/[id]/personalizar/SecaoPerguntasCadastro';
import type { EstadoAcessos } from '../../onboardings/[id]/personalizar/tipos';
import { FormularioCliente } from '../FormularioCliente';
import { SeletorResponsavel, type Responsavel } from '../SeletorResponsavel';

export const dynamic = 'force-dynamic';

/** Pontos de partida da personalização (S6-2, S6-3). Se a API falhar, a seção não aparece. */
async function buscar<T>(caminho: string): Promise<T | null> {
  const resposta = await fetch(`${URL_API}${caminho}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  }).catch(() => null);
  if (!resposta?.ok) return null;
  return (await resposta.json()) as T;
}

export default async function PaginaNovoCliente() {
  const usuario = await exigirSessao();
  const ehAdmin = usuario.papel === 'admin';
  const [perguntas, acessos, equipe] = await Promise.all([
    buscar<{ campos: Campo[] }>('/formulario/padrao'),
    buscar<EstadoAcessos>('/acessos/padrao'),
    ehAdmin ? buscar<{ responsaveis: Responsavel[] }>('/equipe/responsaveis') : null,
  ]);
  return (
    <>
      <h1>Novo cliente</h1>
      <FormularioCliente>
        {equipe && equipe.responsaveis.length > 1 && (
          <SeletorResponsavel responsaveis={equipe.responsaveis} euId={usuario.id} />
        )}
        {perguntas && <SecaoPerguntasCadastro padrao={perguntas.campos} />}
        {acessos && <SecaoAcessosCadastro padrao={acessos} />}
      </FormularioCliente>
    </>
  );
}
