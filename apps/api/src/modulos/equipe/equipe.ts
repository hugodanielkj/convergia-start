import {
  NaoEncontradoError,
  RegraVioladaError,
  type Papel,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { emAndamento, validarAlteracaoPropria, validarPessoa } from '@convergia/core/equipe';
import { STATUS_ONBOARDING } from '@convergia/core/onboarding';
import { registrarAuditoria } from '../../base/auditoria.js';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import type { PrismaClient } from '../../base/prisma.js';

/** Pessoa da equipe como a tela Configurações › Equipe mostra. */
export interface PessoaEquipe {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  readonly ativo: boolean;
  /** Onboardings em andamento sob a responsabilidade dela (passam para outra pessoa ao desativar). */
  readonly emAndamento: number;
}

const STATUS_EM_ANDAMENTO = STATUS_ONBOARDING.filter(emAndamento);
const CAMPOS = { id: true, nome: true, email: true, papel: true, ativo: true } as const;

/** O e-mail já usado em qualquer agência quebraria o login, que procura o e-mail em todas (D-21). */
export class EmailEmUsoError extends Error {
  override readonly name = 'EmailEmUsoError';
}

const ator = (u: UsuarioAutenticado) => `usuario:${u.id}`;

const contraPropriaConta = (usuario: UsuarioAutenticado, alvoId: string): void => {
  if (validarAlteracaoPropria(usuario.id, alvoId)) {
    throw new RegraVioladaError(
      'RN-03',
      'O administrador não pode desativar nem mudar o próprio papel',
    );
  }
};

export async function listarEquipe(prisma: PrismaDaAgencia): Promise<PessoaEquipe[]> {
  const [pessoas, contagem] = await Promise.all([
    prisma.usuario.findMany({ select: CAMPOS, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] }),
    prisma.onboarding.groupBy({
      by: ['responsavelId'],
      where: { statusGeral: { in: STATUS_EM_ANDAMENTO } },
      _count: { _all: true },
    }),
  ]);
  const porPessoa = new Map(contagem.map((c) => [c.responsavelId, c._count._all]));
  return pessoas.map((p) => ({ ...p, emAndamento: porPessoa.get(p.id) ?? 0 }));
}

/** Quem pode ser responsável por um onboarding: a equipe ativa (RN-08). */
export function listarResponsaveis(prisma: PrismaDaAgencia) {
  return prisma.usuario.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, email: true, papel: true },
    orderBy: { nome: 'asc' },
  });
}

export interface DadosPessoa {
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
}

export async function cadastrarPessoa(
  prisma: PrismaDaAgencia,
  prismaGlobal: PrismaClient,
  usuario: UsuarioAutenticado,
  dados: DadosPessoa,
): Promise<PessoaEquipe> {
  const pessoa = validarPessoa(dados);
  if (!pessoa.ok) throw new RegraVioladaError('RN-03', pessoa.erro);
  if ((await prismaGlobal.usuario.count({ where: { email: pessoa.email } })) > 0) {
    throw new EmailEmUsoError();
  }
  const criada = await prisma.usuario
    .create({
      data: {
        agenciaId: usuario.agenciaId,
        nome: pessoa.nome,
        email: pessoa.email,
        papel: dados.papel,
      },
      select: CAMPOS,
    })
    .catch((erro: unknown) => {
      // Dois cadastros ao mesmo tempo com o mesmo e-mail: o índice único decide.
      if (erro instanceof Error && 'code' in erro && erro.code === 'P2002')
        throw new EmailEmUsoError();
      throw erro;
    });
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: ator(usuario),
    acao: 'equipe.cadastrada',
    entidade: 'Usuario',
    entidadeId: criada.id,
    dados: { papel: criada.papel },
  });
  return { ...criada, emAndamento: 0 };
}

export async function editarPessoa(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  id: string,
  dados: { nome: string; papel: Papel },
): Promise<void> {
  const atual = await prisma.usuario.findFirst({ where: { id }, select: CAMPOS });
  if (!atual) throw new NaoEncontradoError('Pessoa');
  if (atual.papel !== dados.papel) contraPropriaConta(usuario, id);
  const pessoa = validarPessoa({ nome: dados.nome, email: atual.email });
  if (!pessoa.ok) throw new RegraVioladaError('RN-03', pessoa.erro);
  await prisma.usuario.update({ where: { id }, data: { nome: pessoa.nome, papel: dados.papel } });
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: ator(usuario),
    acao: 'equipe.editada',
    entidade: 'Usuario',
    entidadeId: id,
    dados: { papelAntes: atual.papel, papelDepois: dados.papel },
  });
}

async function exigirAtivo(prisma: PrismaDaAgencia, id: string, motivo: string): Promise<void> {
  const pessoa = await prisma.usuario.findFirst({
    where: { id, ativo: true },
    select: { id: true },
  });
  if (!pessoa) throw new RegraVioladaError('RN-08', motivo);
}

/**
 * Desativa e passa os onboardings em andamento para `novoResponsavelId` (padrão: quem desativa).
 * As sessões abertas caem na hora. Concluídos e cancelados ficam com quem saiu, como histórico.
 */
export async function desativarPessoa(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  id: string,
  novoResponsavelId: string = usuario.id,
): Promise<{ transferidos: number }> {
  contraPropriaConta(usuario, id);
  const alvo = await prisma.usuario.findFirst({ where: { id }, select: { id: true } });
  if (!alvo) throw new NaoEncontradoError('Pessoa');
  if (novoResponsavelId === id) {
    throw new RegraVioladaError('RN-08', 'Escolha outra pessoa para assumir os onboardings');
  }
  await exigirAtivo(prisma, novoResponsavelId, 'Quem assume os onboardings precisa estar ativo');

  const [, transferencia] = await prisma.$transaction([
    prisma.usuario.update({ where: { id }, data: { ativo: false } }),
    prisma.onboarding.updateMany({
      where: { responsavelId: id, statusGeral: { in: STATUS_EM_ANDAMENTO } },
      data: { responsavelId: novoResponsavelId },
    }),
    prisma.sessao.deleteMany({ where: { usuarioId: id } }),
  ]);
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: ator(usuario),
    acao: 'equipe.desativada',
    entidade: 'Usuario',
    entidadeId: id,
    dados: { novoResponsavelId, transferidos: transferencia.count },
  });
  return { transferidos: transferencia.count };
}

export async function reativarPessoa(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  id: string,
): Promise<void> {
  const { count } = await prisma.usuario.updateMany({ where: { id }, data: { ativo: true } });
  if (count === 0) throw new NaoEncontradoError('Pessoa');
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: ator(usuario),
    acao: 'equipe.reativada',
    entidade: 'Usuario',
    entidadeId: id,
  });
}

/** RN-08: o Admin troca o responsável do onboarding por alguém ativo da equipe. */
export async function trocarResponsavel(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  responsavelId: string,
): Promise<void> {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: { responsavelId: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  await exigirAtivo(prisma, responsavelId, 'O novo responsável precisa estar ativo');
  if (onboarding.responsavelId === responsavelId) return;
  await prisma.onboarding.update({ where: { id: onboardingId }, data: { responsavelId } });
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: ator(usuario),
    acao: 'onboarding.responsavel_alterado',
    entidade: 'Onboarding',
    entidadeId: onboardingId,
    dados: { de: onboarding.responsavelId, para: responsavelId },
  });
}
