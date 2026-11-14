import { dataLocal } from '@convergia/core/agenda';
import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeAlterarConfiguracoes,
  type PublicadorEventos,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { validarAjustePrazo, type ErroAjustePrazo } from '@convergia/core/prazo';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { colunaDeData, textoDaData } from './recalcular.js';

const MENSAGEM: Record<ErroAjustePrazo, string> = {
  data_invalida: 'Informe uma data válida.',
  data_no_passado: 'O novo prazo não pode ser uma data que já passou.',
  justificativa_obrigatoria: 'Explique o motivo do ajuste.',
  justificativa_invalida: 'A justificativa está longa demais.',
};

const ENCERRADOS = new Set(['primeiro_conteudo_entregue', 'concluido', 'cancelado']);

/**
 * O responsável (ou o Admin) muda o prazo à mão, com justificativa (RN-47). A alteração é
 * auditada (RN-77) e publica `prazo.alterado` para o cliente ser avisado (S5). O dia da captação
 * usada no cálculo continua guardado: se ela mudar de dia, o prazo é recalculado (RN-46).
 */
export async function ajustarPrazo(
  prisma: PrismaDaAgencia,
  eventos: PublicadorEventos,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  entrada: { readonly data: string; readonly justificativa: string },
  agora: Date,
): Promise<{ data: string; anterior: string }> {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    select: { responsavelId: true, statusGeral: true, prazo: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeAlterarConfiguracoes(usuario) && onboarding.responsavelId !== usuario.id) {
    throw new ProibidoError('RN-02');
  }
  if (!onboarding.prazo) {
    throw new RegraVioladaError('RN-45', 'O prazo só existe depois que a captação é agendada');
  }
  if (ENCERRADOS.has(onboarding.statusGeral)) {
    throw new RegraVioladaError('RN-47', 'Este onboarding não tem mais prazo a ajustar');
  }

  const agencia = await prisma.agencia.findUniqueOrThrow({
    where: { id: usuario.agenciaId },
    select: { fusoHorario: true },
  });
  const validacao = validarAjustePrazo({ ...entrada, hoje: dataLocal(agora, agencia.fusoHorario) });
  if (!validacao.ok) throw new RegraVioladaError('RN-47', MENSAGEM[validacao.erro]);

  const anterior = textoDaData(onboarding.prazo.data);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`prazo:${onboardingId}`}))`;
    await tx.prazoLiberacao.update({
      where: { onboardingId },
      data: {
        data: colunaDeData(validacao.data),
        origem: 'manual',
        justificativa: validacao.justificativa,
      },
    });
    await tx.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'prazo.ajustado',
        entidade: 'Onboarding',
        entidadeId: onboardingId,
        dados: { anterior, data: validacao.data, justificativa: validacao.justificativa },
      },
    });
  });

  if (anterior !== validacao.data) {
    await eventos.publicar({
      tipo: 'prazo.alterado',
      agenciaId: usuario.agenciaId,
      ocorridoEm: agora,
      dados: { onboardingId, data: validacao.data, anterior, origem: 'manual' },
    });
  }
  return { data: validacao.data, anterior };
}
