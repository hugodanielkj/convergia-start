const MS_POR_HORA = 3_600_000;

/**
 * RN-66: "reenviar lembrete" respeita um intervalo mínimo desde o último envio, para não incomodar
 * o cliente (`intervaloMinimoReenvioHoras` da ConfigAgencia). Diz quando volta a poder.
 */
export function podeReenviarLembrete(
  ultimoEnvio: Date | null,
  agora: Date,
  intervaloHoras: number,
): { pode: boolean; liberaEm: Date | null } {
  if (!ultimoEnvio) return { pode: true, liberaEm: null };
  const liberaEm = new Date(ultimoEnvio.getTime() + intervaloHoras * MS_POR_HORA);
  return agora >= liberaEm ? { pode: true, liberaEm: null } : { pode: false, liberaEm };
}
