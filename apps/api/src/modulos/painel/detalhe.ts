import {
  NaoEncontradoError,
  ProibidoError,
  podeVerOnboarding,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { acoesDisponiveis, garantirReabertura, type AcaoManual } from '@convergia/core/estados';
import { garantirExclusao } from '@convergia/core/lgpd';
import { onboardingAtivo, type StatusOnboarding, type TipoEtapa } from '@convergia/core/onboarding';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { lerAcessosDaAgencia } from '../acessos/acessos.js';
import { lerCampos } from '../formulario/modelo.js';

export interface RespostaDoCampo {
  readonly chave: string;
  readonly rotulo: string;
  readonly tipo: string;
  readonly valor: unknown;
}

export interface AcoesDoDetalhe {
  readonly status: AcaoManual[];
  readonly reabrirFormulario: boolean;
  readonly fecharFormulario: boolean;
  readonly regenerarLink: boolean;
  readonly exportar: boolean;
  readonly excluir: boolean;
}

const cabe = (verificar: () => void): boolean => {
  try {
    verificar();
    return true;
  } catch {
    return false;
  }
};

/** Respostas na ordem dos campos da versão respondida, com o rótulo de cada um (RN-65). */
function respostasComRotulo(camposJson: unknown, respostas: unknown): RespostaDoCampo[] {
  const valores = (respostas ?? {}) as Record<string, unknown>;
  return lerCampos(camposJson)
    .filter((c) => c.chave in valores)
    .map((c) => ({ chave: c.chave, rotulo: c.rotulo, tipo: c.tipo, valor: valores[c.chave] }));
}

/**
 * Tudo o que a tela de detalhe mostra (RN-65): cliente, status, etapas, link, respostas, acessos,
 * agendamentos, arquivos e as ações que cabem agora para quem está vendo. A linha do tempo vem da
 * auditoria (`GET /onboardings/:id/auditoria`). Admin ou responsável (RN-02).
 */
export async function detalharOnboarding(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
) {
  const o = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: {
      id: true,
      statusGeral: true,
      criadoEm: true,
      responsavelId: true,
      responsavel: { select: { id: true, nome: true } },
      cliente: {
        select: {
          id: true,
          nomeEmpresa: true,
          nomeContato: true,
          whatsapp: true,
          email: true,
          onboardings: { select: { statusGeral: true } },
        },
      },
      etapas: { select: { tipo: true, status: true } },
      link: { select: { expiraEm: true, regeneradoEm: true } },
      agendamentos: {
        orderBy: { inicio: 'asc' },
        select: { id: true, tipo: true, inicio: true, fim: true, status: true, localOuLink: true },
      },
    },
  });
  if (!o) throw new NaoEncontradoError('Onboarding');
  if (!podeVerOnboarding(usuario, o.responsavelId)) throw new ProibidoError('RN-02');

  const [resposta, acessos, arquivos] = await Promise.all([
    prisma.respostaFormulario.findFirst({
      where: { onboardingId },
      select: {
        respostas: true,
        enviadaEm: true,
        fechadaEm: true,
        reabertaEm: true,
        versao: { select: { numero: true, campos: true } },
      },
    }),
    lerAcessosDaAgencia(prisma, usuario, onboardingId),
    prisma.arquivo.findMany({
      where: { clienteId: o.cliente.id },
      orderBy: { criadoEm: 'asc' },
      select: { id: true, nomeOriginal: true, tipo: true, tamanho: true, criadoEm: true },
    }),
  ]);

  const status: StatusOnboarding = o.statusGeral;
  const ehAdmin = usuario.papel === 'admin';
  const etapaFormulario = o.etapas.find((e) => e.tipo === 'formulario')?.status ?? 'pendente';
  const acoes: AcoesDoDetalhe = {
    status: acoesDisponiveis(status, ehAdmin),
    reabrirFormulario: cabe(() => {
      garantirReabertura('formulario', etapaFormulario, status);
    }),
    fecharFormulario: Boolean(resposta?.enviadaEm) && !resposta?.fechadaEm,
    regenerarLink: onboardingAtivo(status),
    exportar: ehAdmin,
    excluir:
      ehAdmin &&
      cabe(() => {
        garantirExclusao(o.cliente.onboardings.map((x) => x.statusGeral));
      }),
  };

  const ordem = (tipo: TipoEtapa) => ['formulario', 'acessos', 'reuniao', 'captacao'].indexOf(tipo);
  return {
    id: o.id,
    statusGeral: status,
    criadoEm: o.criadoEm,
    responsavel: o.responsavel,
    cliente: {
      id: o.cliente.id,
      nomeEmpresa: o.cliente.nomeEmpresa,
      nomeContato: o.cliente.nomeContato,
      whatsapp: o.cliente.whatsapp,
      email: o.cliente.email,
    },
    etapas: [...o.etapas].sort((a, b) => ordem(a.tipo) - ordem(b.tipo)),
    link: o.link,
    formulario: resposta
      ? {
          versao: resposta.versao.numero,
          enviadaEm: resposta.enviadaEm,
          fechadaEm: resposta.fechadaEm,
          reabertaEm: resposta.reabertaEm,
          respostas: respostasComRotulo(resposta.versao.campos, resposta.respostas),
        }
      : null,
    acessos,
    agendamentos: o.agendamentos,
    arquivos,
    // Chegam com o envio de mensagens (S5); o campo já existe no contrato da tela.
    notificacoes: [],
    acoes,
  };
}
