import { NaoEncontradoError, type UsuarioAutenticado } from '@convergia/core/base';
import { LIMITES_LEMBRETES, validarJanelaEnvio, type ErroJanela } from '@convergia/core/lembretes';
import { z } from 'zod';
import { registrarAuditoria } from '../../../base/auditoria.js';
import type { PrismaDaAgencia } from '../../../base/escopo-agencia.js';

const L = LIMITES_LEMBRETES;
const listaDe = (max: number) =>
  z
    .array(z.number().int().min(1).max(max))
    .max(L.maxItens)
    .transform((v) => [...new Set(v)].sort((a, b) => a - b));

/** Campos de `ConfigAgencia` que a tela Configurações › Lembretes edita (RN-56, RN-57, RN-59). */
export const esquemaConfigLembretes = z.object({
  lembretesPendenciaDias: listaDe(L.maxDiaPendencia),
  maxLembretesPendencia: z.number().int().min(0).max(L.maxQuantidadePendencia),
  lembretesCompromissoHoras: listaDe(L.maxHorasCompromisso),
  janelaEnvioInicio: z.string().max(5),
  janelaEnvioFim: z.string().max(5),
  diasEnvioPermitidos: z
    .array(z.number().int())
    .max(7)
    .transform((v) => [...new Set(v)].sort((a, b) => a - b)),
});
export type ConfigLembretes = z.infer<typeof esquemaConfigLembretes>;

const CAMPOS = {
  lembretesPendenciaDias: true,
  maxLembretesPendencia: true,
  lembretesCompromissoHoras: true,
  janelaEnvioInicio: true,
  janelaEnvioFim: true,
  diasEnvioPermitidos: true,
} as const;

export async function lerConfigLembretes(prisma: PrismaDaAgencia): Promise<ConfigLembretes> {
  const config = await prisma.configAgencia.findFirst({ select: CAMPOS });
  if (!config) throw new NaoEncontradoError('Configuração da agência');
  return config;
}

/** Salva a configuração (só Admin, RN-03); recusa janela impossível (RN-59). Auditado (RN-77). */
export async function salvarConfigLembretes(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  config: ConfigLembretes,
): Promise<ErroJanela | null> {
  const erro = validarJanelaEnvio({
    inicio: config.janelaEnvioInicio,
    fim: config.janelaEnvioFim,
    dias: config.diasEnvioPermitidos,
  });
  if (erro) return erro;
  const { count } = await prisma.configAgencia.updateMany({ data: config });
  if (count === 0) throw new NaoEncontradoError('Configuração da agência');
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: `usuario:${usuario.id}`,
    acao: 'config.lembretes_alterada',
    entidade: 'Agencia',
    entidadeId: usuario.agenciaId,
  });
  return null;
}
