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
  escolhaTravada,
  etapaAcessos,
  instrucoesDe,
  validarEscolha,
  validarMarcacao,
  type PlataformaAcesso,
  type SituacaoAcesso,
  type StatusAcesso,
  type StatusEtapaAcessos,
} from '@convergia/core/acessos';
import { registrarAuditoria } from '../../base/auditoria.js';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { exigirEtapaLiberada } from '../liberacao/liberacao.js';

export interface AcessoVisao {
  readonly plataforma: PlataformaAcesso;
  readonly nome: string;
  /** Sempre verdadeiro: o cliente só vê as plataformas escolhidas para ele (RN-27). */
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

/** Plataformas marcadas por padrão no cadastro: as da config da agência (RN-27, D-06). */
export async function plataformasPadrao(prisma: PrismaDaAgencia): Promise<PlataformaAcesso[]> {
  const config = await prisma.configAgencia.findFirst({
    select: { plataformasObrigatorias: true },
  });
  const escolha = validarEscolha(config?.plataformasObrigatorias ?? []);
  return escolha.ok ? escolha.plataformas : ['instagram', 'facebook'];
}

/** RN-27: plataformas pedidas a este cliente; sem escolha gravada, as padrão da agência. */
export async function plataformasEscolhidas(
  prisma: PrismaDaAgencia,
  onboardingId: string,
): Promise<PlataformaAcesso[]> {
  const escolha = await prisma.escolhaAcessos.findFirst({ where: { onboardingId } });
  if (!escolha) return plataformasPadrao(prisma);
  const valida = validarEscolha(escolha.plataformas);
  return valida.ok ? valida.plataformas : plataformasPadrao(prisma);
}

/** Situação de cada plataforma escolhida, sem criar linhas (leitura para a RN-79). */
export async function situacoesEscolhidas(
  prisma: PrismaDaAgencia,
  onboardingId: string,
): Promise<SituacaoAcesso[]> {
  const [escolhidas, linhas] = await Promise.all([
    plataformasEscolhidas(prisma, onboardingId),
    prisma.acessoPlataforma.findMany({
      where: { onboardingId },
      select: { plataforma: true, status: true, informadoEm: true },
    }),
  ]);
  return escolhidas.map((p): SituacaoAcesso => {
    const linha = linhas.find((l) => l.plataforma === p);
    return {
      status: linha?.status ?? 'pendente',
      informado: (linha?.informadoEm ?? null) !== null,
    };
  });
}

/** Cria as linhas que faltam (só das escolhidas) e devolve a situação de cada plataforma. */
async function garantirLinhas(
  prisma: PrismaDaAgencia,
  agenciaId: string,
  onboardingId: string,
  escolhidas: readonly PlataformaAcesso[],
) {
  await prisma.acessoPlataforma.createMany({
    data: escolhidas.map((plataforma) => ({ agenciaId, onboardingId, plataforma })),
    skipDuplicates: true,
  });
  const linhas = await prisma.acessoPlataforma.findMany({ where: { onboardingId } });
  return linhas.filter((l) => (escolhidas as readonly string[]).includes(l.plataforma));
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
  const escolhidas = await plataformasEscolhidas(prisma, onboardingId);
  const [linhas, config] = await Promise.all([
    garantirLinhas(prisma, agenciaId, onboardingId, escolhidas),
    prisma.configAcessos.findFirst(),
  ]);
  const ids = lerIdentificadores(config?.identificadores);
  const etapa = await sincronizarEtapa(prisma, onboardingId, escolhidas, linhas);
  const plataformas = escolhidas.map((plataforma): AcessoVisao => {
    const linha = linhas.find((l) => l.plataforma === plataforma);
    const identificador = ids[plataforma]?.trim() || null;
    const { nome, passos } = instrucoesDe(plataforma, identificador);
    return {
      plataforma,
      nome,
      obrigatoria: true,
      status: linha?.status ?? 'pendente',
      motivo: linha?.motivo ?? null,
      informado: (linha?.informadoEm ?? null) !== null,
      passos,
      identificador,
    };
  });
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
  await exigirEtapaLiberada(prisma, onboardingId, 'acessos');
  const escolhidas = await plataformasEscolhidas(prisma, onboardingId);
  if (!escolhidas.includes(plataforma)) throw new NaoEncontradoError('Plataforma');
  const linhas = await garantirLinhas(prisma, agenciaId, onboardingId, escolhidas);
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
  const escolhidas = await plataformasEscolhidas(prisma, onboardingId);
  if (!escolhidas.includes(plataforma)) throw new NaoEncontradoError('Plataforma');
  await garantirLinhas(prisma, usuario.agenciaId, onboardingId, escolhidas);
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

export interface EstadoEscolha {
  readonly plataformas: { plataforma: PlataformaAcesso; nome: string; escolhida: boolean }[];
  /** RN-27: a etapa já começou; a escolha não muda mais. */
  readonly travada: boolean;
}

const opcoes = (escolhidas: readonly PlataformaAcesso[]): EstadoEscolha['plataformas'] =>
  PLATAFORMAS_ACESSO.map((plataforma) => ({
    plataforma,
    nome: instrucoesDe(plataforma, null).nome,
    escolhida: escolhidas.includes(plataforma),
  }));

/** Ponto de partida da seção "Personalizar acessos" do cadastro (RN-27). */
export async function lerEscolhaPadrao(prisma: PrismaDaAgencia): Promise<EstadoEscolha> {
  return { plataformas: opcoes(await plataformasPadrao(prisma)), travada: false };
}

async function travadaAgora(prisma: PrismaDaAgencia, onboardingId: string): Promise<boolean> {
  const linhas = await prisma.acessoPlataforma.findMany({
    where: { onboardingId },
    select: { status: true, informadoEm: true },
  });
  return escolhaTravada(
    linhas.map((l) => ({ status: l.status, informado: l.informadoEm !== null })),
  );
}

export async function lerEscolha(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
): Promise<EstadoEscolha> {
  await carregarOnboarding(prisma, usuario, onboardingId);
  const [escolhidas, travada] = await Promise.all([
    plataformasEscolhidas(prisma, onboardingId),
    travadaAgora(prisma, onboardingId),
  ]);
  return { plataformas: opcoes(escolhidas), travada };
}

export type ResultadoSalvarEscolha =
  { readonly tipo: 'salva'; readonly estado: EstadoEscolha } | { readonly tipo: 'travada' };

/**
 * A agência escolhe as plataformas deste cliente (RN-27): pelo menos uma, só antes de a etapa
 * começar. Linhas das desmarcadas saem (ainda estão pendentes). Auditado (RN-77).
 */
export async function salvarEscolha(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  plataformas: readonly string[],
): Promise<ResultadoSalvarEscolha> {
  await carregarOnboarding(prisma, usuario, onboardingId);
  const escolha = validarEscolha(plataformas);
  if (!escolha.ok) {
    throw new RegraVioladaError(
      'RN-27',
      escolha.erro === 'nenhuma_plataforma'
        ? 'Escolha pelo menos uma plataforma'
        : 'Plataforma desconhecida',
    );
  }
  if (await travadaAgora(prisma, onboardingId)) return { tipo: 'travada' };

  await prisma.$transaction([
    prisma.escolhaAcessos.upsert({
      where: { onboardingId },
      create: { onboardingId, agenciaId: usuario.agenciaId, plataformas: escolha.plataformas },
      update: { plataformas: escolha.plataformas },
    }),
    prisma.acessoPlataforma.deleteMany({
      where: { onboardingId, plataforma: { notIn: escolha.plataformas } },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'acessos.escolhidos',
        entidade: 'Onboarding',
        entidadeId: onboardingId,
        dados: { plataformas: escolha.plataformas.join(',') },
      },
    }),
  ]);
  await montarEstado(prisma, usuario.agenciaId, onboardingId);
  return { tipo: 'salva', estado: await lerEscolha(prisma, usuario, onboardingId) };
}
