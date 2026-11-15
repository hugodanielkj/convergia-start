import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIXO = 'sha256=';

/** Confere o `X-Hub-Signature-256` da Meta (HMAC SHA-256 do corpo cru com o app secret), em tempo constante. */
export function assinaturaValida(
  corpo: Buffer,
  cabecalho: string | undefined,
  appSecret: string,
): boolean {
  if (!cabecalho?.startsWith(PREFIXO)) return false;
  const recebida = Buffer.from(cabecalho.slice(PREFIXO.length), 'hex');
  const esperada = createHmac('sha256', appSecret).update(corpo).digest();
  return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
}

/** Assina um corpo como a Meta faz (usado nos testes). */
export const assinar = (corpo: Buffer | string, appSecret: string): string =>
  `${PREFIXO}${createHmac('sha256', appSecret).update(corpo).digest('hex')}`;
