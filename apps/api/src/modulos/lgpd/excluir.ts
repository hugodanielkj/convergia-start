import {
  NaoEncontradoError,
  type PublicadorEventos,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { garantirConfirmacao, garantirExclusao } from '@convergia/core/lgpd';
import type { Armazenamento } from '@convergia/core/uploads';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    /**
     * Os dados do cliente foram apagados (RN-73). Módulo com tabela ligada ao onboarding só por
     * coluna (sem relação com `onDelete: Cascade`) apaga as suas linhas ao receber este evento.
     */
    'cliente.dados_excluidos': { clienteId: string; onboardingIds: string[] };
  }
}

export interface ResultadoExclusao {
  readonly onboardings: number;
  readonly arquivos: number;
}

/**
 * Exclui de vez os dados de um cliente, a pedido (RN-73). Só o Admin (rota), só com os onboardings
 * cancelados ou concluídos e com o nome da empresa como confirmação. Os arquivos saem do storage
 * antes do banco: se o banco falhar, a exclusão pode ser repetida sem deixar arquivo para trás.
 * A auditoria fica (ações e IDs), mas perde os `dados`, que podem ter texto livre do cliente.
 */
export async function excluirDadosDoCliente(
  prisma: PrismaDaAgencia,
  armazenamento: Armazenamento,
  eventos: PublicadorEventos,
  usuario: UsuarioAutenticado,
  clienteId: string,
  confirmacao: string,
  agora: Date,
): Promise<ResultadoExclusao> {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId },
    select: {
      nomeEmpresa: true,
      onboardings: {
        select: { id: true, statusGeral: true, agendamentos: { select: { id: true } } },
      },
    },
  });
  if (!cliente) throw new NaoEncontradoError('Cliente');
  garantirExclusao(cliente.onboardings.map((o) => o.statusGeral));
  garantirConfirmacao(cliente.nomeEmpresa, confirmacao);

  const onboardingIds = cliente.onboardings.map((o) => o.id);
  const agendamentoIds = cliente.onboardings.flatMap((o) => o.agendamentos.map((a) => a.id));
  const arquivos = await prisma.arquivo.findMany({ where: { clienteId }, select: { chave: true } });
  for (const { chave } of arquivos) await armazenamento.apagar(chave);

  const doCliente = { onboardingId: { in: onboardingIds } };
  await prisma.$transaction([
    prisma.auditoriaLog.updateMany({
      where: { entidadeId: { in: [clienteId, ...onboardingIds, ...agendamentoIds] } },
      data: { dados: Prisma.DbNull },
    }),
    prisma.arquivo.deleteMany({ where: { clienteId } }),
    prisma.consentimentoCliente.deleteMany({ where: doCliente }),
    prisma.primeiroAcesso.deleteMany({ where: doCliente }),
    prisma.respostaFormulario.deleteMany({ where: doCliente }),
    prisma.acessoPlataforma.deleteMany({ where: doCliente }),
    // Onboardings, etapas, link, agendamentos e histórico de status saem em cascata.
    prisma.cliente.deleteMany({ where: { id: clienteId } }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'cliente.dados_excluidos',
        entidade: 'Cliente',
        entidadeId: clienteId,
        dados: { onboardings: onboardingIds.length, arquivos: arquivos.length },
        em: agora,
      },
    }),
  ]);

  await eventos.publicar({
    tipo: 'cliente.dados_excluidos',
    agenciaId: usuario.agenciaId,
    ocorridoEm: agora,
    dados: { clienteId, onboardingIds },
  });
  return { onboardings: onboardingIds.length, arquivos: arquivos.length };
}
