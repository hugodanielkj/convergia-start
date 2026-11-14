import { URL_API } from '../../../../_lib/url-api';
import { CAMPO_ACESSOS_MEXEU, CAMPO_PERGUNTAS, CAMPO_PLATAFORMAS } from './tipos';

async function enviar(
  caminho: string,
  corpo: unknown,
  cookie: string,
  falha: string,
): Promise<string | null> {
  try {
    const resposta = await fetch(`${URL_API}${caminho}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(corpo),
      cache: 'no-store',
    });
    return resposta.ok ? null : falha;
  } catch {
    return falha;
  }
}

/**
 * Depois do cadastro (S6-2, S6-3): grava as perguntas e as plataformas do novo cliente, se a
 * agência mexeu nelas. Devolve um aviso quando algo não deu certo; o cliente já foi criado e pode
 * ser ajustado em "Personalizar".
 */
export async function aplicarPersonalizacao(
  onboardingId: string,
  dados: FormData,
  cookie: string,
): Promise<string | null> {
  const base = `/onboardings/${encodeURIComponent(onboardingId)}`;
  const avisos: string[] = [];

  const perguntas = dados.get(CAMPO_PERGUNTAS);
  if (typeof perguntas === 'string' && perguntas !== '') {
    const aviso = await enviar(
      `${base}/formulario/personalizacao`,
      { campos: JSON.parse(perguntas) as unknown },
      cookie,
      'As perguntas personalizadas não foram salvas.',
    );
    if (aviso) avisos.push(aviso);
  }

  if (dados.get(CAMPO_ACESSOS_MEXEU) === '1') {
    const plataformas = dados.getAll(CAMPO_PLATAFORMAS).filter((p) => typeof p === 'string');
    const aviso = await enviar(
      `${base}/acessos/escolha`,
      { plataformas },
      cookie,
      'As plataformas escolhidas não foram salvas.',
    );
    if (aviso) avisos.push(aviso);
  }

  return avisos.length > 0 ? `${avisos.join(' ')} Ajuste em "Personalizar".` : null;
}
