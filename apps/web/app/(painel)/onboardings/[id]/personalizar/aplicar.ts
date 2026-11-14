import { URL_API } from '../../../../_lib/url-api';
import { CAMPO_PERGUNTAS } from './tipos';

/**
 * Depois do cadastro (S6-2): grava as perguntas personalizadas do novo cliente, se a agência mexeu
 * nelas. Devolve um aviso quando não deu certo; o cliente já foi criado e pode ser ajustado depois.
 */
export async function aplicarPersonalizacao(
  onboardingId: string,
  dados: FormData,
  cookie: string,
): Promise<string | null> {
  const perguntas = dados.get(CAMPO_PERGUNTAS);
  if (typeof perguntas !== 'string' || perguntas === '') return null;
  const falha = 'As perguntas personalizadas não foram salvas. Ajuste em "Personalizar".';
  try {
    const resposta = await fetch(
      `${URL_API}/onboardings/${encodeURIComponent(onboardingId)}/formulario/personalizacao`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ campos: JSON.parse(perguntas) as unknown }),
        cache: 'no-store',
      },
    );
    return resposta.ok ? null : falha;
  } catch {
    return falha;
  }
}
