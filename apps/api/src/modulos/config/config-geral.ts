import { NaoEncontradoError, type UsuarioAutenticado } from '@convergia/core/base';
import {
  diferencas,
  extrairConfigGeral,
  validarConfigGeral,
  type ConfigGeral,
  type ErroConfigGeral,
} from '@convergia/core/config';
import { registrarAuditoria } from '../../base/auditoria.js';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

export async function lerConfigGeral(
  prisma: PrismaDaAgencia,
  agenciaId: string,
): Promise<ConfigGeral> {
  // `Agencia` não tem escopo automático (é a própria agência): filtra pelo id da sessão.
  const [agencia, config] = await Promise.all([
    prisma.agencia.findUnique({ where: { id: agenciaId }, select: { nome: true } }),
    prisma.configAgencia.findFirst(),
  ]);
  if (!agencia || !config) throw new NaoEncontradoError('Configuração da agência');
  return extrairConfigGeral(agencia.nome, config);
}

/**
 * Salva a tela Geral (só Admin, RN-03). Vale daqui para frente: prazos já calculados e links já
 * emitidos não mudam. Audita só os campos que mudaram, com antes e depois (RN-77).
 */
export async function salvarConfigGeral(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  entrada: ConfigGeral,
): Promise<{ ok: true; config: ConfigGeral } | { ok: false; erros: ErroConfigGeral[] }> {
  const nova = { ...entrada, nomeAgencia: entrada.nomeAgencia.trim() };
  const erros = validarConfigGeral(nova);
  if (erros.length > 0) return { ok: false, erros };

  const antes = await lerConfigGeral(prisma, usuario.agenciaId);
  const mudou = diferencas(antes, nova);
  if (Object.keys(mudou).length === 0) return { ok: true, config: antes };

  const { nomeAgencia, ...campos } = nova;
  await prisma.$transaction([
    prisma.agencia.update({ where: { id: usuario.agenciaId }, data: { nome: nomeAgencia } }),
    prisma.configAgencia.updateMany({ data: campos }),
  ]);
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: `usuario:${usuario.id}`,
    acao: 'config.geral_alterada',
    entidade: 'Agencia',
    entidadeId: usuario.agenciaId,
    dados: mudou,
  });
  return { ok: true, config: nova };
}
