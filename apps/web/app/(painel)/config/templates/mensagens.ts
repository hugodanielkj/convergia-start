export type TipoTemplate =
  'convite' | 'confirmacao_prazo' | 'lembrete_pendencia' | 'lembrete_compromisso';

export const ROTULO_TEMPLATE: Record<TipoTemplate, { titulo: string; quando: string }> = {
  convite: { titulo: 'Convite inicial', quando: 'Enviado ao cliente com o link do onboarding.' },
  confirmacao_prazo: {
    titulo: 'Confirmação final com prazo',
    quando: 'Enviado quando reunião e captação estão marcadas.',
  },
  lembrete_pendencia: {
    titulo: 'Lembrete de pendência',
    quando: 'Enviado enquanto faltar alguma etapa do cliente.',
  },
  lembrete_compromisso: {
    titulo: 'Lembrete de compromisso',
    quando: 'Enviado antes da reunião e da captação.',
  },
};

const ERROS: Record<string, string> = {
  vazio: 'O texto não pode ficar vazio.',
  muito_longo: 'O texto é longo demais.',
  sem_link: 'Inclua {{link_onboarding}}: é por ele que o cliente continua.',
  pede_senha: 'Não peça senha ou credenciais na mensagem. O cliente usa o link do sistema.',
};

/** Texto de um erro devolvido pela API ao salvar (RN-29). */
export function mensagemDoErro(erro: { codigo: string; detalhe?: string }): string {
  if (erro.codigo === 'variavel_desconhecida') {
    return `A variável {{${erro.detalhe ?? ''}}} não existe.`;
  }
  return ERROS[erro.codigo] ?? 'Texto inválido.';
}
