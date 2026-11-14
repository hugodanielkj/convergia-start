import { cookies } from 'next/headers';
import { URL_API } from '../../../_lib/url-api';
import type { Campo } from '../../config/formulario/tipos';
import { SecaoPerguntasCadastro } from '../../onboardings/[id]/personalizar/SecaoPerguntasCadastro';
import { FormularioCliente } from '../FormularioCliente';

export const dynamic = 'force-dynamic';

/** Perguntas do modelo padrão, ponto de partida da personalização (S6-2). Falha = sem a seção. */
async function camposPadrao(): Promise<Campo[] | null> {
  const resposta = await fetch(`${URL_API}/formulario/padrao`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  }).catch(() => null);
  if (!resposta?.ok) return null;
  return ((await resposta.json()) as { campos: Campo[] }).campos;
}

export default async function PaginaNovoCliente() {
  const padrao = await camposPadrao();
  return (
    <>
      <h1>Novo cliente</h1>
      <FormularioCliente>{padrao && <SecaoPerguntasCadastro padrao={padrao} />}</FormularioCliente>
    </>
  );
}
