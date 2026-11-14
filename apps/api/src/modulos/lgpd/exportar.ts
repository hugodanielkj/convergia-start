import { NaoEncontradoError, type UsuarioAutenticado } from '@convergia/core/base';
import { nomeArquivoExportacao } from '@convergia/core/lgpd';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

export interface Exportacao {
  readonly nomeArquivo: string;
  readonly conteudo: Record<string, unknown>;
}

const porOnboarding = <T extends { onboardingId: string }>(lista: readonly T[], id: string) =>
  lista.filter((item) => item.onboardingId === id);

/**
 * Exporta tudo o que a agência guarda de um cliente (RN-73): cadastro, onboardings com etapas,
 * histórico de status, link (sem o token), consentimentos, respostas, acessos, agendamentos, a lista
 * dos arquivos e a auditoria. Os arquivos em si são baixados um a um. Só o Admin (rota).
 */
export async function exportarDadosDoCliente(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  clienteId: string,
  agora: Date,
): Promise<Exportacao> {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId },
    select: {
      id: true,
      nomeEmpresa: true,
      nomeContato: true,
      whatsapp: true,
      email: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });
  if (!cliente) throw new NaoEncontradoError('Cliente');

  const onboardings = await prisma.onboarding.findMany({
    where: { clienteId },
    orderBy: { criadoEm: 'asc' },
    select: {
      id: true,
      statusGeral: true,
      criadoEm: true,
      responsavel: { select: { nome: true } },
      etapas: { select: { tipo: true, status: true, atualizadoEm: true } },
      link: { select: { criadoEm: true, expiraEm: true, regeneradoEm: true } },
      transicoes: {
        orderBy: { em: 'asc' },
        select: { de: true, para: true, motivo: true, ator: true, em: true },
      },
      notificacoes: {
        orderBy: { criadoEm: 'asc' },
        select: {
          tipo: true,
          categoria: true,
          corpo: true,
          status: true,
          canal: true,
          criadoEm: true,
          enviadaEm: true,
        },
      },
      preferencia: { select: { lembretesDesativadosEm: true } },
      agendamentos: {
        orderBy: { inicio: 'asc' },
        select: { id: true, tipo: true, inicio: true, fim: true, status: true, localOuLink: true },
      },
    },
  });
  const ids = onboardings.map((o) => o.id);
  const doCliente = { onboardingId: { in: ids } };
  const [primeirosAcessos, consentimentos, respostas, acessos, arquivos] = await Promise.all([
    prisma.primeiroAcesso.findMany({ where: doCliente, select: { onboardingId: true, em: true } }),
    prisma.consentimentoCliente.findMany({
      where: doCliente,
      select: { onboardingId: true, versaoTermo: true, aceitoEm: true },
    }),
    prisma.respostaFormulario.findMany({
      where: doCliente,
      select: {
        onboardingId: true,
        respostas: true,
        enviadaEm: true,
        fechadaEm: true,
        reabertaEm: true,
        versao: { select: { numero: true } },
        versaoCliente: { select: { numero: true, campos: true } },
      },
    }),
    prisma.acessoPlataforma.findMany({
      where: doCliente,
      select: {
        onboardingId: true,
        plataforma: true,
        status: true,
        motivo: true,
        informadoEm: true,
      },
    }),
    prisma.arquivo.findMany({
      where: { clienteId },
      select: { id: true, nomeOriginal: true, tipo: true, tamanho: true, criadoEm: true },
    }),
  ]);
  const entidades = [
    clienteId,
    ...ids,
    ...onboardings.flatMap((o) => o.agendamentos.map((a) => a.id)),
  ];
  const auditoria = await prisma.auditoriaLog.findMany({
    where: { entidadeId: { in: entidades } },
    orderBy: { em: 'asc' },
    select: { acao: true, entidade: true, entidadeId: true, ator: true, dados: true, em: true },
  });

  await prisma.auditoriaLog.create({
    data: {
      agenciaId: usuario.agenciaId,
      ator: `usuario:${usuario.id}`,
      acao: 'cliente.dados_exportados',
      entidade: 'Cliente',
      entidadeId: clienteId,
      em: agora,
    },
  });

  return {
    nomeArquivo: nomeArquivoExportacao(cliente.nomeEmpresa, agora),
    conteudo: {
      exportadoEm: agora.toISOString(),
      cliente,
      onboardings: onboardings.map((o) => ({
        ...o,
        responsavel: o.responsavel.nome,
        primeiroAcessoEm: primeirosAcessos.find((p) => p.onboardingId === o.id)?.em ?? null,
        consentimentos: porOnboarding(consentimentos, o.id),
        formulario: porOnboarding(respostas, o.id)[0] ?? null,
        acessos: porOnboarding(acessos, o.id),
      })),
      arquivos,
      auditoria,
    },
  };
}
