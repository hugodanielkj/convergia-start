/** Limites de tamanho de endereço de e-mail (RFC 5321). */
const EMAIL_MAX = 254;
const PARTE_LOCAL_MAX = 64;
const ROTULO_MAX = 63;

export type ResultadoEmail =
  | { readonly ok: true; readonly email: string }
  | { readonly ok: false; readonly erro: 'email_invalido' };

// Subconjunto prático da RFC 5322: sem aspas, comentários ou caracteres não ASCII.
const PARTE_LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const ROTULO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const TLD = /^([a-z]{2,}|xn--[a-z0-9-]+)$/;

const INVALIDO: ResultadoEmail = { ok: false, erro: 'email_invalido' };

/**
 * Valida e normaliza um e-mail (RN-05). O endereço vai todo para minúsculas, para que
 * `Maria@Empresa.com` e `maria@empresa.com` contem como o mesmo contato no alerta de duplicidade (RN-07).
 */
export function normalizarEmail(entrada: string): ResultadoEmail {
  const email = entrada.trim().toLowerCase();
  if (email.length > EMAIL_MAX) return INVALIDO;

  const partes = email.split('@');
  if (partes.length !== 2) return INVALIDO;
  const [local = '', dominio = ''] = partes;

  return parteLocalValida(local) && dominioValido(dominio) ? { ok: true, email } : INVALIDO;
}

function parteLocalValida(local: string): boolean {
  return local.length <= PARTE_LOCAL_MAX && PARTE_LOCAL.test(local);
}

function dominioValido(dominio: string): boolean {
  const rotulos = dominio.split('.');
  const tld = rotulos.at(-1) ?? '';
  return (
    rotulos.length >= 2 &&
    rotulos.every((rotulo) => rotulo.length <= ROTULO_MAX && ROTULO.test(rotulo)) &&
    TLD.test(tld)
  );
}
