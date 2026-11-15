/** Motivos de aviso interno (RN-58), mais os dois extras aprovados pelo PO. */
export const TIPOS_ALERTA = [
  'concluiu',
  'sem_acao',
  'lembretes_esgotados',
  'acesso_invalido',
  'nao_compareceu',
  'prazo_atencao',
  'prazo_atrasado',
  'mensagem_falhou',
  'link_solicitado',
] as const;
export type TipoAlerta = (typeof TIPOS_ALERTA)[number];

/** Texto do aviso, sem dados pessoais: o nome da empresa entra na frente, na tela e no e-mail. */
const TEXTO: Readonly<Record<TipoAlerta, string>> = {
  concluiu: 'concluiu todas as etapas do onboarding.',
  sem_acao: 'abriu o link, mas não avança há alguns dias.',
  lembretes_esgotados: 'recebeu todos os lembretes e ainda tem etapas pendentes.',
  acesso_invalido: 'tem um acesso marcado como inválido.',
  nao_compareceu: 'não compareceu a um compromisso.',
  prazo_atencao: 'está com o prazo de liberação perto do fim.',
  prazo_atrasado: 'está com o prazo de liberação atrasado.',
  mensagem_falhou: 'não recebeu uma mensagem: falhou no WhatsApp e no e-mail.',
  link_solicitado: 'pediu um link novo (o anterior expirou).',
};

export function textoDoAlerta(tipo: TipoAlerta, empresa: string, detalhe?: string | null): string {
  const base = `${empresa} ${TEXTO[tipo]}`;
  return detalhe ? `${base} (${detalhe})` : base;
}

export const ehTipoAlerta = (valor: string): valor is TipoAlerta =>
  (TIPOS_ALERTA as readonly string[]).includes(valor);

/** Ações que a própria agência faz: se foi o responsável, ele já sabe e não recebe e-mail (PO). */
const FEITOS_PELA_AGENCIA: ReadonlySet<TipoAlerta> = new Set(['acesso_invalido', 'nao_compareceu']);

export function alertaPedeEmail(
  tipo: TipoAlerta,
  responsavelId: string,
  atorUsuarioId: string | null,
): boolean {
  return !(FEITOS_PELA_AGENCIA.has(tipo) && atorUsuarioId === responsavelId);
}

export interface Destinatario {
  readonly email: string;
  readonly ativo: boolean;
}

/** E-mail do alerta: o responsável; se inativo, os Admins ativos (decisão do PO). */
export function destinatariosDoAlerta(
  responsavel: Destinatario,
  admins: readonly Destinatario[],
): string[] {
  if (responsavel.ativo) return [responsavel.email];
  return [...new Set(admins.filter((a) => a.ativo).map((a) => a.email))];
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** RN-58: link aberto e nenhuma ação em `dias` dias, com etapa ainda pendente. */
export function semAcaoHaDias(ultimaAtividade: Date, agora: Date, dias: number): boolean {
  return agora.getTime() - ultimaAtividade.getTime() >= dias * MS_POR_DIA;
}

/** Espera antes de avisar que os lembretes acabaram sem resposta (decisão do PO: 24h). */
export const ESPERA_ESGOTADOS_HORAS = 24;

export function lembretesEsgotados(ultimoLembreteEm: Date, agora: Date): boolean {
  return agora.getTime() - ultimoLembreteEm.getTime() >= ESPERA_ESGOTADOS_HORAS * 60 * 60 * 1000;
}

/** Retentativa do e-mail do alerta: 3 tentativas, 1 e 5 minutos; sem credencial, 15 minutos. */
export const RETENTATIVA_EMAIL_ALERTA = {
  tentativas: 3,
  esperasMinutos: [1, 5],
  esperaSemCredencialMinutos: 15,
} as const;

export type PassoEmailAlerta =
  | { readonly acao: 'enviado' }
  | { readonly acao: 'aguardar'; readonly em: Date; readonly contaTentativa: boolean }
  | { readonly acao: 'falhou' };

export function proximoPassoEmailAlerta(
  tentativasFeitas: number,
  resultado: { ok: true } | { ok: false; semCredencial: boolean },
  agora: Date,
): PassoEmailAlerta {
  if (resultado.ok) return { acao: 'enviado' };
  const r = RETENTATIVA_EMAIL_ALERTA;
  if (resultado.semCredencial) {
    return {
      acao: 'aguardar',
      em: new Date(agora.getTime() + r.esperaSemCredencialMinutos * 60_000),
      contaTentativa: false,
    };
  }
  const feitas = tentativasFeitas + 1;
  if (feitas >= r.tentativas) return { acao: 'falhou' };
  const espera = r.esperasMinutos[feitas - 1] ?? r.esperasMinutos.at(-1) ?? 1;
  return {
    acao: 'aguardar',
    em: new Date(agora.getTime() + espera * 60_000),
    contaTentativa: true,
  };
}
