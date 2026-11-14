import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeVerOnboarding,
  type Plataforma,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import {
  PLATAFORMAS_ACESSO,
  etapaAcessos,
  instrucoesDe,
  validarMarcacao,
  type PlataformaAcesso,
  type SituacaoAcesso,
  type StatusAcesso,
  type StatusEtapaAcessos,
} from '@convergia/core/acessos';
import { registrarAuditoria } from '../../base/auditoria.js';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

export interface AcessoVisao {
  readonly plataforma: PlataformaAcesso;
  readonly nome: string;
  readonly obrigatoria: boolean;
  readonly status: StatusAcesso;
  readonly motivo: string | null;
  readonly informado: boolean;
  readonly passos: readonly string[];
  readonly identificador: string | null;
}

export interface EstadoAcessos {
  readonly etapa: StatusEtapaAcessos;
  readonly plataformas: AcessoVisao[];
}

type Identificadores = Partial<Record<PlataformaAcesso, string>>;

const lerIdentificadores = (json: unknown): Identificadores =>
  typeof json === 'object' && json !== null ? json : {};

async function obrigatorias(prisma: PrismaDaAgencia): Promise<readonly Plataforma[]> {
  const config = await prisma.configAgencia.findFirst({
    select: { plataformasObrigatorias: true },
  });
  return (config?.plataformasObrigatorias ?? ['instagram', 'facebook']) as Plataforma[];
}

/** Cria as linhas que faltam e devolve a situação de cada plataforma. */
async function garantirLinhas(prisma: PrismaDaAgencia, agenciaId: string, onboardingId: string) {
  await prisma.acessoPlataforma.createMany({
    data: PLATAFORMAS_ACESSO.map((plataforma) => ({ agenciaId, onboardingId, plataforma })),
    skipDuplicates: true,
  });
  return prisma.acessoPlataforma.findMany({ where: { onboardingId } });
}

/** Atualiza o status da etapa "acessos" a partir das plataformas (RN-27). */
async function sincronizarEtapa(
  prisma: PrismaDaAgencia,
  onboardingId: string,
  obrig: readonly Plataforma[],
  linhas: { plataforma: string; status: StatusAcesso; informadoEm: Date | null }[],
): Promise<StatusEtapaAcessos> {
  const situacoes: Partial<Record<Plataforma, SituacaoAcesso>> = {};
  for (const l of linhas) {
    situacoes[l.plataforma as Plataforma] = {
      status: l.status,
      informado: l.informadoEm !== null,
    };
  }
  const etapa = etapaAcessos(situacoes, obrig);
  await prisma.etapaOnboarding.updateMany({
    where: { onboardingId, tipo: 'acessos', status: { not: 'bloqueada' } },
    data: { status: etapa },
  });
  return etapa;
}

async function montarEstado(
  prisma: PrismaDaAgencia,
  agenciaId: string,
  onboardingId: string,
): Promise<EstadoAcessos> {
  const [linhas, obrig, config] = await Promise.all([
    garantirLinhas(prisma, agenciaId, onboardingId),
    obrigatorias(prisma),
    prisma.configAcessos.findFirst(),
  ]);
  const ids = lerIdentificadores(config?.identificadores);
  const etapa = await sincronizarEtapa(prisma, onboardingId, obrig, linhas);
  const plataformas = PLATAFORMAS_ACESSO.map((plataforma): AcessoVisao => {
    const linha = linhas.find((l) => l.plataforma === plataforma);
    const identificador = ids[plataforma]?.trim() || null;
    const { nome, passos } = instrucoesDe(plataforma, identificador);
    return {
      plataforma,
      nome,
      obrigatoria: obrig.includes(plataforma),
      status: linha?.status ?? 'pendente',
      motivo: linha?.motivo ?? null,
      informado: (linha?.informadoEm ?? null) !== null,
      passos,
      identificador,
    };
  });
  // Obrigatórias primeiro, para o cliente ver o essencial no topo (D-06).
  plataformas.sort((a, b) => Number(b.obrigatoria) - Number(a.obrigatoria));
  return { etapa, plataformas };
}

export const lerAcessosDoCliente = (
  prisma: PrismaDaAgencia,
  agenciaId: string,
  onboardingId: string,
) => montarEstado(prisma, agenciaId, onboardingId);

export type ResultadoInformar = 'registrado' | 'ja_concedido';

/** O cliente avisa que já adicionou a agência. Se estava inválido, volta a pendente (RN-28). */
export async function informarAcessoDoCliente(
  prisma: PrismaDaAgencia,
  agenciaId: string,
  onboardingId: string,
  plataforma: PlataformaAcesso,
  agora: Date,
): Promise<{ resultado: ResultadoInformar; estado: EstadoAcessos }> {
  const linhas = await garantirLinhas(prisma, agenciaId, onboardingId);
  const atual = linhas.find((l) => l.plataforma === plataforma);
  if (atual?.status === 'concedido') {
    return {
      resultado: 'ja_concedido',
      estado: await montarEstado(prisma, agenciaId, onboardingId),
    };
  }
  await prisma.acessoPlataforma.updateMany({
    where: { onboardingId, plataforma },
    data: { status: 'pendente', motivo: null, informadoEm: agora },
  });
  await registrarAuditoria(prisma, {
    agenciaId,
    ator: `cliente:${onboardingId}`,
    acao: 'acesso.informado',
    entidade: 'Onboarding',
    entidadeId: onboardingId,
    dados: { plataforma },
  });
  return { resultado: 'registrado', estado: await montarEstado(prisma, agenciaId, onboardingId) };
}

async function carregarOnboarding(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
) {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: { responsavelId: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeVerOnboarding(usuario, onboarding.responsavelId)) throw new ProibidoError('RN-02');
}

export async function lerAcessosDaAgencia(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
): Promise<EstadoAcessos> {
  await carregarOnboarding(prisma, usuario, onboardingId);
  return montarEstado(prisma, usuario.agenciaId, onboardingId);
}

/** A agência marca o acesso como concedido ou inválido, com motivo (RN-28). Auditado (RN-77). */
export async function marcarAcesso(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  plataforma: PlataformaAcesso,
  status: 'concedido' | 'invalido',
  motivoInformado: string | undefined,
): Promise<EstadoAcessos> {
  await carregarOnboarding(prisma, usuario, onboardingId);
  const marcacao = validarMarcacao(status, motivoInformado);
  if (!marcacao.ok) {
    throw new RegraVioladaError(
      'RN-28',
      marcacao.erro === 'motivo_obrigatorio'
        ? 'Informe o motivo ao marcar o acesso como inválido'
        : 'O motivo é longo demais',
    );
  }
  await garantirLinhas(prisma, usuario.agenciaId, onboardingId);
  await prisma.acessoPlataforma.updateMany({
    where: { onboardingId, plataforma },
    data: {
      status,
      motivo: marcacao.motivo,
      // Inválido: o cliente precisa avisar de novo depois de corrigir.
      ...(status === 'invalido' ? { informadoEm: null } : {}),
    },
  });
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: `usuario:${usuario.id}`,
    acao: status === 'concedido' ? 'acesso.concedido' : 'acesso.invalidado',
    entidade: 'Onboarding',
    entidadeId: onboardingId,
    dados: { plataforma, motivo: marcacao.motivo },
  });
  return montarEstado(prisma, usuario.agenciaId, onboardingId);
}

export async function lerConfigAcessos(prisma: PrismaDaAgencia): Promise<Identificadores> {
  const config = await prisma.configAcessos.findFirst();
  return lerIdentificadores(config?.identificadores);
}

/** Admin define o identificador da agência em cada plataforma (RN-22, RN-03). */
export async function salvarConfigAcessos(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  identificadores: Identificadores,
): Promise<void> {
  const limpos: Identificadores = {};
  for (const p of PLATAFORMAS_ACESSO) {
    const valor = identificadores[p]?.trim();
    if (valor) limpos[p] = valor;
  }
  await prisma.configAcessos.upsert({
    where: { agenciaId: usuario.agenciaId },
    create: { agenciaId: usuario.agenciaId, identificadores: limpos },
    update: { identificadores: limpos },
  });
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: `usuario:${usuario.id}`,
    acao: 'acessos.config_alterada',
    entidade: 'Agencia',
    entidadeId: usuario.agenciaId,
  });
}
