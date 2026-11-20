/** Templates que a agência edita (seção 8). Os outros eventos da RN-55 ainda não têm template. */
export const TIPOS_TEMPLATE = [
  'convite',
  'confirmacao_prazo',
  'lembrete_pendencia',
  'lembrete_compromisso',
  'horario_alterado',
] as const;
export type TipoTemplate = (typeof TIPOS_TEMPLATE)[number];

/** Variáveis da seção 8, mais as do lembrete de compromisso (`tipo`, `data`, `hora`). */
export const VARIAVEIS_TEMPLATE = [
  'nome_contato',
  'nome_empresa',
  'nome_agencia',
  'link_onboarding',
  'data_reuniao',
  'hora_reuniao',
  'data_captacao',
  'hora_captacao',
  'local_captacao',
  'prazo_liberacao',
  'pendencias',
  'responsavel',
  'tipo',
  'data',
  'hora',
] as const;
export type VariavelTemplate = (typeof VARIAVEIS_TEMPLATE)[number];

export const LIMITE_TEMPLATE = 1600;

export const TEMPLATES_PADRAO: Readonly<Record<TipoTemplate, string>> = {
  convite:
    'Olá, {{nome_contato}}! Seja bem-vindo(a) à {{nome_agencia}} 🎉\n' +
    'Para começarmos a produzir o conteúdo da {{nome_empresa}} o quanto antes, preparamos um passo a passo rápido (leva poucos minutos): {{link_onboarding}}\n' +
    'Lá você preenche os dados da empresa, libera os acessos e já escolhe os horários da nossa primeira reunião e da captação.',
  confirmacao_prazo:
    'Tudo certo, {{nome_contato}}! ✅\n' +
    'Reunião: {{data_reuniao}} às {{hora_reuniao}}.\n' +
    'Captação: {{data_captacao}} às {{hora_captacao}} ({{local_captacao}}).\n' +
    'Previsão de liberação dos primeiros conteúdos: {{prazo_liberacao}}.',
  lembrete_pendencia:
    'Oi, {{nome_contato}}! Faltam só alguns passos para começarmos: {{pendencias}}. Você conclui por aqui: {{link_onboarding}}',
  lembrete_compromisso:
    'Lembrete: {{tipo}} da {{nome_empresa}} em {{data}} às {{hora}}. Precisa reagendar? {{link_onboarding}}',
  horario_alterado:
    'Olá, {{nome_contato}}! A {{tipo}} da {{nome_empresa}} mudou para {{data}} às {{hora}}. Qualquer dúvida, é só falar com a gente.',
};

/** Templates que mandam o cliente de volta ao sistema; sem o link, não há como agir (RN-29). */
const EXIGEM_LINK: ReadonlySet<TipoTemplate> = new Set(['convite', 'lembrete_pendencia']);

const MARCADOR = /\{\{\s*([^{}]*?)\s*\}\}/g;

export type ErroTemplate =
  | { codigo: 'vazio' }
  | { codigo: 'muito_longo' }
  | { codigo: 'variavel_desconhecida'; detalhe: string }
  | { codigo: 'sem_link' }
  | { codigo: 'pede_senha' };

/** Nomes entre chaves duplas no texto, na ordem em que aparecem. */
export function variaveisUsadas(texto: string): string[] {
  return [...texto.matchAll(MARCADOR)].map((m) => m[1] ?? '');
}

// Pedir "senha", "password" ou "credencial" no texto vai contra a RN-29 (o cliente usa o link).
const PEDIDO_DE_SENHA = /\b(senha|senhas|password|passwords|credenciais|credencial)\b/i;

const eVariavel = (nome: string): nome is VariavelTemplate =>
  (VARIAVEIS_TEMPLATE as readonly string[]).includes(nome);

/** Confere o texto antes de salvar: variáveis conhecidas, tamanho, link e RN-29. */
export function validarTemplate(tipo: TipoTemplate, texto: string): ErroTemplate[] {
  if (texto.trim() === '') return [{ codigo: 'vazio' }];
  const erros: ErroTemplate[] = [];
  if (texto.length > LIMITE_TEMPLATE) erros.push({ codigo: 'muito_longo' });
  const usadas = variaveisUsadas(texto);
  for (const nome of new Set(usadas)) {
    if (!eVariavel(nome)) erros.push({ codigo: 'variavel_desconhecida', detalhe: nome });
  }
  if (EXIGEM_LINK.has(tipo) && !usadas.includes('link_onboarding'))
    erros.push({ codigo: 'sem_link' });
  if (PEDIDO_DE_SENHA.test(texto.replace(MARCADOR, ''))) erros.push({ codigo: 'pede_senha' });
  return erros;
}

/** Preenche as variáveis; sem valor, a variável some em vez de aparecer como `{{...}}`. */
export function preencherTemplate(
  texto: string,
  valores: Partial<Record<VariavelTemplate, string>>,
): string {
  return texto.replace(MARCADOR, (_, nome: string) =>
    eVariavel(nome) ? (valores[nome] ?? '') : '',
  );
}

/** Dados de exemplo da pré-visualização na tela de configuração. */
export const VALORES_EXEMPLO: Readonly<Record<VariavelTemplate, string>> = {
  nome_contato: 'Maria',
  nome_empresa: 'Padaria Pão Quente',
  nome_agencia: 'Sua Agência',
  link_onboarding: 'https://exemplo.com/o/abc123',
  data_reuniao: '18/11/2026',
  hora_reuniao: '10:00',
  data_captacao: '25/11/2026',
  hora_captacao: '14:00',
  local_captacao: 'Rua das Flores, 100',
  prazo_liberacao: '09/12/2026',
  pendencias: 'formulário e acessos',
  responsavel: 'Ana',
  tipo: 'reunião',
  data: '18/11/2026',
  hora: '10:00',
};
