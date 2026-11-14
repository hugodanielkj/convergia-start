/** DDI aplicado quando o número é digitado sem código de país (RN-05). */
export const DDI_BRASIL = '55';

/** DDDs em uso no Plano de Numeração da Anatel. */
const DDDS_BRASIL: ReadonlySet<string> = new Set([
  ...['11', '12', '13', '14', '15', '16', '17', '18', '19'],
  ...['21', '22', '24', '27', '28'],
  ...['31', '32', '33', '34', '35', '37', '38'],
  ...['41', '42', '43', '44', '45', '46', '47', '48', '49'],
  ...['51', '53', '54', '55'],
  ...['61', '62', '63', '64', '65', '66', '67', '68', '69'],
  ...['71', '73', '74', '75', '77', '79'],
  ...['81', '82', '83', '84', '85', '86', '87', '88', '89'],
  ...['91', '92', '93', '94', '95', '96', '97', '98', '99'],
]);

/** Limites de dígitos de um número E.164 completo, incluindo o DDI (ITU-T E.164). */
const E164_MIN_DIGITOS = 8;
const E164_MAX_DIGITOS = 15;

export type ErroTelefone = 'telefone_invalido' | 'ddd_invalido';

export type ResultadoTelefone =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly erro: ErroTelefone };

const FORMATO_DIGITADO = /^\+?[\d\s().-]+$/;
const CELULAR = /^9\d{8}$/;
const FIXO = /^[2-5]\d{7}$/;

const invalido = (erro: ErroTelefone): ResultadoTelefone => ({ ok: false, erro });

/**
 * Valida e normaliza um telefone para E.164 (RN-05).
 * Sem `+` ou `00`, o número é tratado como brasileiro (DDD + assinante, com ou sem 0 ou 55 na frente).
 */
export function normalizarTelefone(entrada: string): ResultadoTelefone {
  const texto = entrada.trim();
  if (!FORMATO_DIGITADO.test(texto)) return invalido('telefone_invalido');

  const digitos = texto.replace(/\D/g, '');
  const internacional = texto.startsWith('+') || digitos.startsWith('00');
  return internacional
    ? normalizarInternacional(digitos.replace(/^00/, ''))
    : normalizarSemDdi(digitos);
}

function normalizarInternacional(digitos: string): ResultadoTelefone {
  if (digitos.startsWith(DDI_BRASIL)) return normalizarNacional(digitos.slice(DDI_BRASIL.length));

  const tamanhoValido = digitos.length >= E164_MIN_DIGITOS && digitos.length <= E164_MAX_DIGITOS;
  if (!tamanhoValido || digitos.startsWith('0')) return invalido('telefone_invalido');
  return { ok: true, e164: `+${digitos}` };
}

// Tamanho distingue os formatos: nacional tem 10 ou 11 dígitos; com DDI 55, 12 ou 13;
// com o 0 de longa distância na frente, 11 ou 12 começando por 0 (nenhum DDD começa por 0).
function normalizarSemDdi(digitos: string): ResultadoTelefone {
  if (digitos.startsWith('0')) return normalizarNacional(digitos.slice(1));
  if (digitos.length >= 12 && digitos.startsWith(DDI_BRASIL)) {
    return normalizarNacional(digitos.slice(DDI_BRASIL.length));
  }
  return normalizarNacional(digitos);
}

function normalizarNacional(digitos: string): ResultadoTelefone {
  if (digitos.length !== 10 && digitos.length !== 11) return invalido('telefone_invalido');

  const ddd = digitos.slice(0, 2);
  const assinante = digitos.slice(2);
  if (!DDDS_BRASIL.has(ddd)) return invalido('ddd_invalido');
  // Fixo é aceito porque WhatsApp Business funciona em linha fixa.
  if (!CELULAR.test(assinante) && !FIXO.test(assinante)) return invalido('telefone_invalido');

  return { ok: true, e164: `+${DDI_BRASIL}${digitos}` };
}
