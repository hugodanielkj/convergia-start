import { URL_API } from '../../../../_lib/url-api';
import { CartaoEtapa } from '../../_componentes/CartaoEtapa';
import { FormularioCliente } from './FormularioCliente';
import type { EstadoFormulario } from './tipos';

/** Etapa A: formulário de dados da empresa, com rascunho automático (RN-17, RN-18, RN-21). */
export async function EtapaFormulario({ token }: { token: string }) {
  const resposta = await fetch(
    `${URL_API}/publico/onboardings/${encodeURIComponent(token)}/formulario`,
    { cache: 'no-store' },
  );
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} no formulário`);
  const estado = (await resposta.json()) as EstadoFormulario;

  return (
    <CartaoEtapa
      titulo="Dados da empresa"
      status={estado.situacao === 'rascunho' ? 'em_andamento' : 'concluida'}
    >
      <FormularioCliente token={token} inicial={estado} />
    </CartaoEtapa>
  );
}
