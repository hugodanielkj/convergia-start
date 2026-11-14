/** Termo de consentimento do cliente (RN-72). Mudou o texto? Mude a versão. */
export const TERMO_ATUAL = {
  versao: '2026-11-14',
  texto:
    'Autorizo a agência a usar os dados e os arquivos que eu informar neste onboarding apenas para ' +
    'prestar o serviço contratado e a entrar em contato comigo por WhatsApp ou e-mail sobre ele. ' +
    'Posso pedir à agência a exportação ou a exclusão dos meus dados a qualquer momento.',
} as const;

/** O aceite só vale para a versão do termo que está em vigor (RN-72). */
export function aceiteValido(versao: string): boolean {
  return versao === TERMO_ATUAL.versao;
}
