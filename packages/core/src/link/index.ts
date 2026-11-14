import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

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
