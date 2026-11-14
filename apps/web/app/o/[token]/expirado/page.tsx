import { BotaoPedirNovoLink } from './BotaoPedirNovoLink';
import estilos from './expirado.module.css';

/**
 * Página amigável de link expirado (RN-11). Não consulta a API ao abrir: assim ela é igual para
 * qualquer token e não revela se o link existe. A página do cliente (S2-1) manda para cá ao
 * receber 410 de `GET /publico/onboardings/:token`.
 */
export default async function PaginaLinkExpirado({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className={estilos.pagina}>
      <h1>Este link expirou</h1>
      <p>
        Por segurança, o link de onboarding tem prazo de validade. Sem problemas: peça um novo e a
        agência envia para você.
      </p>
      <BotaoPedirNovoLink token={token} />
    </main>
  );
}
