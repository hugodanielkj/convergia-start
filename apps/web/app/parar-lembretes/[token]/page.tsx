import type { Metadata } from 'next';
import { URL_API } from '../../_lib/url-api';
import { BotaoParar } from './BotaoParar';
import estilos from './parar.module.css';

export const metadata: Metadata = {
  title: 'Parar lembretes · Convergia Start',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/**
 * Opt-out de lembretes (RN-61). Abrir a página não desativa nada: a pré-visualização de links do
 * WhatsApp também abre a página, então só o botão (POST) desativa.
 */
export default async function PaginaPararLembretes({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const r = await fetch(`${URL_API}/publico/lembretes/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  if (!r.ok) {
    return (
      <main className={estilos.pagina}>
        <h1>Link inválido</h1>
        <p>Este link não é válido. Se quiser parar de receber lembretes, fale com a agência.</p>
      </main>
    );
  }
  const { empresa, desativado } = (await r.json()) as { empresa: string; desativado: boolean };
  return (
    <main className={estilos.pagina}>
      <h1>Lembretes do onboarding</h1>
      {desativado ? (
        <p role="status" className={estilos.sucesso}>
          Pronto: você não recebe mais lembretes do onboarding da {empresa}.
        </p>
      ) : (
        <>
          <p>
            Você recebe lembretes sobre os passos que faltam no onboarding da {empresa}. Se
            preferir, pode parar de recebê-los. Confirmações de horário e avisos importantes
            continuam.
          </p>
          <BotaoParar token={token} empresa={empresa} />
        </>
      )}
    </main>
  );
}
