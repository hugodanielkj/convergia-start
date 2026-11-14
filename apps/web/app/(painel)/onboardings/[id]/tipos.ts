import { rotuloEtapa, rotuloStatusOnboarding } from '../../clientes/mensagens';
import type { EstadoAcessos } from './acessos/tipos';

// Resposta de GET /onboardings/:id/detalhe (apps/api/src/modulos/painel/detalhe.ts).
export type AcaoStatus = 'pausar' | 'retomar' | 'cancelar' | 'registrar_entrega' | 'encerrar';

export interface Detalhe {
  id: string;
  statusGeral: string;
  criadoEm: string;
  responsavel: { id: string; nome: string };
  cliente: {
    id: string;
    nomeEmpresa: string;
    nomeContato: string;
    whatsapp: string | null;
    email: string | null;
  };
  etapas: { tipo: string; status: string }[];
  link: { expiraEm: string; regeneradoEm: string | null } | null;
  formulario: {
    versao: number;
    enviadaEm: string | null;
    fechadaEm: string | null;
    reabertaEm: string | null;
    respostas: { chave: string; rotulo: string; tipo: string; valor: unknown }[];
  } | null;
  acessos: EstadoAcessos;
  agendamentos: {
    id: string;
    tipo: 'reuniao' | 'captacao';
    inicio: string;
    fim: string;
    status: string;
    localOuLink: string | null;
  }[];
  arquivos: { id: string; nomeOriginal: string; tipo: string; tamanho: number; criadoEm: string }[];
  notificacoes: unknown[];
  acoes: {
    status: AcaoStatus[];
    reabrirFormulario: boolean;
    fecharFormulario: boolean;
    regenerarLink: boolean;
    exportar: boolean;
    excluir: boolean;
  };
}

// Resposta de GET /onboardings/:id/auditoria (apps/api/src/modulos/lgpd/auditoria.ts).
export interface ItemAuditoria {
  id: string;
  em: string;
  acao: string;
  entidade: string;
  ator: { tipo: 'usuario' | 'cliente' | 'sistema'; nome: string | null };
  dados: unknown;
}

/** Botões das ações de status: texto, se pede motivo e se é irreversível (RN-52, RN-53). */
export const ACOES_STATUS: Record<
  AcaoStatus,
  { rotulo: string; pedeMotivo: boolean; perigo: boolean; aviso?: string }
> = {
  pausar: {
    rotulo: 'Pausar',
    pedeMotivo: true,
    perigo: false,
    aviso: 'Lembretes param durante a pausa. O cliente continua podendo preencher.',
  },
  retomar: { rotulo: 'Retomar', pedeMotivo: false, perigo: false },
  cancelar: {
    rotulo: 'Cancelar onboarding',
    pedeMotivo: true,
    perigo: true,
    aviso:
      'Cancelar é definitivo: o link deixa de funcionar e os agendamentos futuros são cancelados.',
  },
  registrar_entrega: {
    rotulo: 'Registrar entrega dos primeiros conteúdos',
    pedeMotivo: false,
    perigo: false,
  },
  encerrar: { rotulo: 'Confirmar encerramento', pedeMotivo: false, perigo: false },
};

/** Grupos de ações da auditoria para o filtro da linha do tempo. */
export const GRUPOS_AUDITORIA = [
  { valor: '', rotulo: 'Tudo' },
  { valor: 'onboarding.', rotulo: 'Status' },
  { valor: 'formulario.', rotulo: 'Formulário' },
  { valor: 'acesso.', rotulo: 'Acessos' },
  { valor: 'agendamento.', rotulo: 'Agendamentos' },
  { valor: 'link.', rotulo: 'Link' },
  { valor: 'cliente.', rotulo: 'Cliente' },
] as const;

const ROTULO_ACAO: Readonly<Record<string, string>> = {
  'cliente.criado': 'Cliente cadastrado',
  'cliente.dados_exportados': 'Dados do cliente exportados',
  'onboarding.criado': 'Onboarding criado',
  'onboarding.primeiro_acesso': 'Cliente abriu o link pela primeira vez',
  'onboarding.status_alterado': 'Status alterado',
  'consentimento.aceito': 'Cliente aceitou o termo de consentimento',
  'formulario.enviado': 'Formulário enviado',
  'formulario.editado': 'Formulário editado pelo cliente',
  'formulario.fechado': 'Formulário fechado para edição',
  'etapa.reaberta': 'Etapa reaberta',
  'acesso.informado': 'Cliente avisou que liberou um acesso',
  'acesso.concedido': 'Acesso confirmado',
  'acesso.invalidado': 'Acesso marcado como inválido',
  'link.regenerado': 'Link regenerado',
  'agendamento.criado': 'Agendamento feito',
  'agendamento.reagendado': 'Agendamento remarcado',
  'agendamento.cancelado': 'Agendamento cancelado',
  'agendamento.realizado': 'Agendamento realizado',
  'agendamento.nao_compareceu': 'Cliente não compareceu',
};

export const rotuloAcaoAuditoria = (acao: string): string => ROTULO_ACAO[acao] ?? acao;

const texto = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Complemento da linha do tempo: de/para do status, motivo, plataforma ou etapa. */
export function detalheDoItem(item: Pick<ItemAuditoria, 'dados'>): string | null {
  if (typeof item.dados !== 'object' || item.dados === null) return null;
  const d = item.dados as Record<string, unknown>;
  const partes: string[] = [];
  const de = texto(d['de']);
  const para = texto(d['para']);
  if (de && para) partes.push(`${rotuloStatusOnboarding(de)} → ${rotuloStatusOnboarding(para)}`);
  const etapa = texto(d['etapa']);
  if (etapa) partes.push(rotuloEtapa(etapa));
  const plataforma = texto(d['plataforma']);
  if (plataforma) partes.push(plataforma.charAt(0).toUpperCase() + plataforma.slice(1));
  const motivo = texto(d['motivo']);
  if (motivo) partes.push(`Motivo: ${motivo}`);
  return partes.length > 0 ? partes.join(' · ') : null;
}

/** Nome de quem fez a ação na linha do tempo. */
export function nomeDoAtor(ator: ItemAuditoria['ator']): string {
  if (ator.tipo === 'sistema') return 'Sistema';
  if (ator.tipo === 'cliente') return ator.nome ? `${ator.nome} (cliente)` : 'Cliente';
  return ator.nome ?? 'Equipe';
}

/** Valor de uma resposta do formulário em texto; uploads mostram o nome do arquivo. */
export function textoDaResposta(
  resposta: { tipo: string; valor: unknown },
  arquivos: readonly { id: string; nomeOriginal: string }[],
): string {
  const lista = Array.isArray(resposta.valor) ? resposta.valor : [resposta.valor];
  const itens = lista
    .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
    .map((v) =>
      resposta.tipo === 'upload'
        ? (arquivos.find((a) => a.id === v)?.nomeOriginal ?? 'arquivo removido')
        : String(v),
    );
  return itens.length > 0 ? itens.join(', ') : '—';
}

/** Mensagem de erro da API (422/403 com `mensagem`) ou um texto padrão. */
export async function mensagemDeErro(resposta: Response): Promise<string> {
  const corpo = (await resposta.json().catch(() => ({}))) as { mensagem?: unknown };
  if (resposta.status === 403) return 'Você não tem permissão para esta ação.';
  return typeof corpo.mensagem === 'string' ? corpo.mensagem : 'Não foi possível concluir.';
}
