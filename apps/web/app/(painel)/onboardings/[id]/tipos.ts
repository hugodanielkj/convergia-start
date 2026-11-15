import { formatarDataHora } from '../../clientes/formatar';
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
  notificacoes: {
    id: string;
    tipo: string;
    categoria: string;
    status: 'pendente' | 'enviada' | 'falhou' | 'cancelada';
    canal: 'whatsapp' | 'email' | null;
    totalTentativas: number;
    erro: string | null;
    criadoEm: string;
    enviadaEm: string | null;
  }[];
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
  'formulario.personalizado': 'Perguntas personalizadas para o cliente',
  'formulario.editado': 'Formulário editado pelo cliente',
  'formulario.fechado': 'Formulário fechado para edição',
  'etapa.reaberta': 'Etapa reaberta',
  'acesso.informado': 'Cliente avisou que liberou um acesso',
  'acesso.concedido': 'Acesso confirmado',
  'acesso.invalidado': 'Acesso marcado como inválido',
  'link.regenerado': 'Link regenerado',
  'convite.reenviado': 'Convite reenviado',
  'lembrete.reenviado': 'Lembrete reenviado',
  'lembretes.desativados': 'Cliente parou de receber lembretes',
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

/** Valor de uma resposta do formulário em texto; listas viram itens separados por vírgula. */
export function textoDaResposta(resposta: { valor: unknown }): string {
  const lista = Array.isArray(resposta.valor) ? resposta.valor : [resposta.valor];
  const itens = lista
    .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
    .map(String);
  return itens.length > 0 ? itens.join(', ') : '—';
}

/** Mensagem de erro da API (422/403 com `mensagem`) ou um texto padrão. */
export async function mensagemDeErro(resposta: Response): Promise<string> {
  const corpo = (await resposta.json().catch(() => ({}))) as { mensagem?: unknown };
  if (resposta.status === 403) return 'Você não tem permissão para esta ação.';
  return typeof corpo.mensagem === 'string' ? corpo.mensagem : 'Não foi possível concluir.';
}

const ROTULO_NOTIFICACAO: Readonly<Record<string, string>> = {
  convite: 'Convite',
  confirmacao_prazo: 'Confirmação com prazo',
  lembrete_pendencia: 'Lembrete de pendência',
  lembrete_compromisso: 'Lembrete de compromisso',
};
const ROTULO_STATUS_NOTIFICACAO: Readonly<Record<string, string>> = {
  pendente: 'Na fila',
  enviada: 'Enviada',
  falhou: 'Falhou',
  cancelada: 'Cancelada',
};
const ROTULO_CANAL: Readonly<Record<string, string>> = { whatsapp: 'WhatsApp', email: 'E-mail' };

/** Linha do histórico de notificações (RN-62): o quê, por onde, situação e motivo da falha. */
export function descreverNotificacao(n: Detalhe['notificacoes'][number]): {
  titulo: string;
  situacao: string;
  detalhe: string | null;
} {
  // Na fila, o canal é só o da última tentativa: mostrá-lo confunde.
  const definitivo = n.status === 'enviada' || n.status === 'falhou';
  const canal = definitivo && n.canal ? (ROTULO_CANAL[n.canal] ?? n.canal) : null;
  const situacao = [ROTULO_STATUS_NOTIFICACAO[n.status] ?? n.status, canal]
    .filter(Boolean)
    .join(' · ');
  let detalhe: string | null = null;
  if (n.erro === 'canal_nao_configurado') detalhe = 'Aguardando as credenciais de envio';
  else if (n.erro === 'opt_out') detalhe = 'O cliente pediu para não receber lembretes';
  else if (n.erro === 'sem_contato') detalhe = 'O cliente não tem WhatsApp nem e-mail';
  else if (n.erro && n.status !== 'enviada') detalhe = `Erro: ${n.erro}`;
  if (n.totalTentativas > 1) {
    detalhe = [detalhe, `${String(n.totalTentativas)} tentativas`].filter(Boolean).join(' · ');
  }
  return { titulo: ROTULO_NOTIFICACAO[n.tipo] ?? n.tipo, situacao, detalhe };
}

/** RN-66 e RN-59: confirmação depois de reenviar convite ou lembrete pelo detalhe. */
export function textoDoReenvio(oque: 'convite' | 'lembrete', enviaEm: string, agora: Date): string {
  const nome = oque === 'convite' ? 'Convite' : 'Lembrete';
  if (new Date(enviaEm).getTime() <= agora.getTime() + 60_000) return `${nome} na fila de envio.`;
  return `${nome} na fila: sai em ${formatarDataHora(enviaEm)}, no horário permitido de envio.`;
}
