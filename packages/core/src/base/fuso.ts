/** Fuso padrão da agência (instrução 7 da spec, D-14). */
export const FUSO_PADRAO = 'America/Sao_Paulo';

/** Indica se `fuso` é um identificador IANA aceito pelo runtime (ex. vindo do navegador, RN-32). */
export function fusoValido(fuso: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}
