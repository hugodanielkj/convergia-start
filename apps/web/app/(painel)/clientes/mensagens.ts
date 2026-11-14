// Textos da tela de clientes. As regras (core) devolvem só códigos; o que o usuário lê fica aqui.

const ERROS_DE_CAMPO: Readonly<Record<string, string>> = {
  obrigatorio: 'Preencha este campo.',
  contato_obrigatorio: 'Informe um WhatsApp ou um e-mail para contato.',
  telefone_invalido: 'Telefone inválido. Use DDD e número, por exemplo (31) 99999-8888.',
  ddd_invalido: 'DDD inexistente. Confira o número.',
  email_invalido: 'E-mail inválido. Confira o endereço.',
};

export function mensagemDeErroCampo(codigo: string): string {
  return ERROS_DE_CAMPO[codigo] ?? 'Valor inválido.';
}

/** Frase do alerta de duplicidade (RN-07): o que coincidiu com o cliente já cadastrado. */
export function descreverMotivos(motivos: readonly ('whatsapp' | 'email')[]): string {
  const temEmail = motivos.includes('email');
  const temWhatsapp = motivos.includes('whatsapp');
  if (temEmail && temWhatsapp) return 'o mesmo e-mail e WhatsApp';
  return temEmail ? 'o mesmo e-mail' : 'o mesmo WhatsApp';
}

const ROTULOS_ETAPA: Readonly<Record<string, string>> = {
  formulario: 'Formulário',
  acessos: 'Acessos',
  reuniao: 'Reunião',
  captacao: 'Captação',
};

const ROTULOS_STATUS_ETAPA: Readonly<Record<string, string>> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

const ROTULOS_STATUS_ONBOARDING: Readonly<Record<string, string>> = {
  criado: 'Criado',
  convite_enviado: 'Convite enviado',
  em_andamento: 'Em andamento',
  aguardando_agendamentos: 'Aguardando agendamentos',
  aguardando_reuniao: 'Aguardando reunião',
  aguardando_captacao: 'Aguardando captação',
  em_producao: 'Em produção',
  primeiro_conteudo_entregue: 'Primeiro conteúdo entregue',
  concluido: 'Concluído',
  pausado: 'Pausado',
  cancelado: 'Cancelado',
};

// Valor desconhecido (status novo que a web ainda não conhece) aparece como veio, sem quebrar a tela.
export const rotuloEtapa = (tipo: string): string => ROTULOS_ETAPA[tipo] ?? tipo;
export const rotuloStatusEtapa = (status: string): string => ROTULOS_STATUS_ETAPA[status] ?? status;
export const rotuloStatusOnboarding = (status: string): string =>
  ROTULOS_STATUS_ONBOARDING[status] ?? status;

/** Status em que o onboarding não tem mais link ativo (RN-12). */
export const STATUS_ENCERRADOS: ReadonlySet<string> = new Set(['concluido', 'cancelado']);
