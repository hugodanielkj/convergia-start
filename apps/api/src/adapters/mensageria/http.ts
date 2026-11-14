import type { ResultadoEnvio } from '@convergia/core/base';

/** Limite de espera de uma chamada ao provedor; passou disso, conta como falha temporária. */
export const TEMPO_LIMITE_MS = 15_000;

/** 408, 429 e 5xx passam com o tempo; outros 4xx (número inválido, credencial) não. */
export const statusTemporario = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

/** Falha de rede ou tempo esgotado: tenta de novo mais tarde. */
export function falhaDeRede(erro: unknown, provedor: string): ResultadoEnvio {
  const nome = erro instanceof Error ? erro.name : 'erro';
  return { ok: false, erro: `${provedor}: ${nome}`, temporario: true };
}
