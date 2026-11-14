import { URL_API } from '../../../../_lib/url-api';
import { CartaoEtapa } from '../../_componentes/CartaoEtapa';
import { AcessosCliente } from './AcessosCliente';
import type { EstadoAcessos } from './tipos';

/** Etapa B: acesso às redes por parceiro, sem senha (RN-22, RN-27, D-05). */
export async function EtapaAcessos({ token }: { token: string }) {
  const resposta = await fetch(
    `${URL_API}/publico/onboardings/${encodeURIComponent(token)}/acessos`,
    { cache: 'no-store' },
  );
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} nos acessos`);
  const estado = (await resposta.json()) as EstadoAcessos;

  return (
    <CartaoEtapa titulo="Acesso às redes sociais" status={estado.etapa}>
      <AcessosCliente token={token} inicial={estado} />
    </CartaoEtapa>
  );
}
