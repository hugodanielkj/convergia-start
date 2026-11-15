import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** Tamanho do token: 256 bits de entropia (RN-10 pede no mínimo 128; D-13 fixa 256). */
export const TOKEN_BYTES = 32;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const FORMATO_HASH = /^[0-9a-f]{64}$/;

/** Fonte de bytes aleatórios injetável, para os testes serem determinísticos. */
export type GeradorBytes = (tamanho: number) => Uint8Array;

export interface TokenLink {
  /** Vai na URL do cliente e nunca é guardado. */
  readonly token: string;
  /** SHA-256 em hexadecimal: é o que o banco guarda (D-13). */
  readonly hash: string;
}

export interface RegistroLink {
  readonly hash: string;
  readonly expiraEm: Date;
}

export type SituacaoLink = 'valido' | 'expirado' | 'invalido';

/** Gera um token novo e o hash para guardar (RN-10, D-13). */
export function gerarTokenLink(gerarBytes: GeradorBytes = randomBytes): TokenLink {
  const bytes = gerarBytes(TOKEN_BYTES);
  if (bytes.length !== TOKEN_BYTES) {
    throw new Error(`Gerador de token precisa devolver ${String(TOKEN_BYTES * 8)} bits`);
  }
  const token = Buffer.from(bytes).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Data de expiração do link: `validadeDias` (RN-11, `validade_link_dias`) após a criação ou regeneração. */
export function calcularExpiracao(criadoEm: Date, validadeDias: number): Date {
  if (!Number.isInteger(validadeDias) || validadeDias < 1) {
    throw new Error('validade_link_dias precisa ser um número inteiro de dias, no mínimo 1');
  }
  return new Date(criadoEm.getTime() + validadeDias * MS_POR_DIA);
}

/**
 * Confere o token recebido na URL com o registro guardado (RN-11, RN-12).
 * Regenerar o link troca o hash, então o token antigo cai em `invalido` na hora (RN-12).
 * `expirado` só aparece para quem tem o token certo; token errado é sempre `invalido`,
 * para a resposta não revelar se um link existe (rules/seguranca.md).
 */
export function verificarLink(token: string, registro: RegistroLink, agora: Date): SituacaoLink {
  if (!tokenConfere(token, registro.hash)) return 'invalido';
  return agora.getTime() >= registro.expiraEm.getTime() ? 'expirado' : 'valido';
}

// Comparação em tempo constante, para o tempo de resposta não denunciar prefixos corretos.
function tokenConfere(token: string, hashGuardado: string): boolean {
  if (!FORMATO_TOKEN.test(token) || !FORMATO_HASH.test(hashGuardado)) return false;
  return timingSafeEqual(Buffer.from(hashToken(token), 'hex'), Buffer.from(hashGuardado, 'hex'));
}

/** Chave do link cifrado: 256 bits (AES-256-GCM). Fica fora do banco, em variável de ambiente. */
export const CHAVE_LINK_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITMO = 'aes-256-gcm';

function exigirChave(chave: Uint8Array): void {
  if (chave.length !== CHAVE_LINK_BYTES) {
    throw new Error(`Chave do link precisa ter ${String(CHAVE_LINK_BYTES * 8)} bits`);
  }
}

/**
 * Cifra o token para os lembretes poderem montar o link de novo (decisão 2026-11-15-b-link-cifrado).
 * IV aleatório a cada chamada; o resultado junta IV, etiqueta de autenticação e texto cifrado.
 */
export function cifrarToken(
  token: string,
  chave: Uint8Array,
  gerarBytes: GeradorBytes = randomBytes,
): string {
  exigirChave(chave);
  const iv = gerarBytes(IV_BYTES);
  const cifra = createCipheriv(ALGORITMO, chave, iv);
  const corpo = Buffer.concat([cifra.update(token, 'utf8'), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), corpo]).toString('base64url');
}

/** Decifra o token. `null` se a chave for outra ou o valor tiver sido alterado. */
export function decifrarToken(cifrado: string, chave: Uint8Array): string | null {
  exigirChave(chave);
  const bytes = Buffer.from(cifrado, 'base64url');
  if (bytes.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decifra = createDecipheriv(ALGORITMO, chave, bytes.subarray(0, IV_BYTES));
    decifra.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const token = Buffer.concat([
      decifra.update(bytes.subarray(IV_BYTES + TAG_BYTES)),
      decifra.final(),
    ]).toString('utf8');
    return FORMATO_TOKEN.test(token) ? token : null;
  } catch {
    return null;
  }
}
