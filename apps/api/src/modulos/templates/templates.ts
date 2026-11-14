import type { UsuarioAutenticado } from '@convergia/core/base';
import { RegraVioladaError } from '@convergia/core/base';
import {
  TEMPLATES_PADRAO,
  TIPOS_TEMPLATE,
  VALORES_EXEMPLO,
  preencherTemplate,
  validarTemplate,
  type ErroTemplate,
  type TipoTemplate,
} from '@convergia/core/templates';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { registrarAuditoria } from '../../base/auditoria.js';

export interface TemplateVisao {
  readonly tipo: TipoTemplate;
  readonly texto: string;
  readonly padrao: string;
  readonly personalizado: boolean;
}

/** Texto vigente de um template: o editado pela agência ou o padrão da spec. */
export async function textoDoTemplate(
  prisma: PrismaDaAgencia,
  tipo: TipoTemplate,
): Promise<string> {
  const salvo = await prisma.templateMensagem.findFirst({ where: { tipo } });
  return salvo?.texto ?? TEMPLATES_PADRAO[tipo];
}

export async function listarTemplates(prisma: PrismaDaAgencia): Promise<TemplateVisao[]> {
  const salvos = await prisma.templateMensagem.findMany();
  return TIPOS_TEMPLATE.map((tipo) => {
    const salvo = salvos.find((s) => s.tipo === tipo);
    return {
      tipo,
      texto: salvo?.texto ?? TEMPLATES_PADRAO[tipo],
      padrao: TEMPLATES_PADRAO[tipo],
      personalizado: salvo !== undefined,
    };
  });
}

export type ResultadoSalvar =
  { readonly tipo: 'salvo' } | { readonly tipo: 'invalido'; readonly erros: ErroTemplate[] };

/** Salva o texto editado (só Admin, RN-03). Recusa variável desconhecida e pedido de senha (RN-29). */
export async function salvarTemplate(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  tipo: TipoTemplate,
  texto: string,
): Promise<ResultadoSalvar> {
  const erros = validarTemplate(tipo, texto);
  if (erros.length > 0) return { tipo: 'invalido', erros };
  await prisma.templateMensagem.upsert({
    where: { agenciaId_tipo: { agenciaId: usuario.agenciaId, tipo } },
    create: { agenciaId: usuario.agenciaId, tipo, texto },
    update: { texto },
  });
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: `usuario:${usuario.id}`,
    acao: 'template.alterado',
    entidade: 'Agencia',
    entidadeId: usuario.agenciaId,
    dados: { tipo },
  });
  return { tipo: 'salvo' };
}

/** Volta ao texto padrão da spec apagando a edição da agência. */
export async function restaurarTemplate(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  tipo: TipoTemplate,
): Promise<void> {
  await prisma.templateMensagem.deleteMany({ where: { tipo } });
  await registrarAuditoria(prisma, {
    agenciaId: usuario.agenciaId,
    ator: `usuario:${usuario.id}`,
    acao: 'template.restaurado',
    entidade: 'Agencia',
    entidadeId: usuario.agenciaId,
    dados: { tipo },
  });
}

/** Pré-visualização com dados de exemplo, sem salvar. */
export function previaDoTemplate(tipo: TipoTemplate, texto: string): string {
  const erros = validarTemplate(tipo, texto);
  if (erros.some((e) => e.codigo === 'vazio')) {
    throw new RegraVioladaError('RN-55', 'O texto está vazio');
  }
  return preencherTemplate(texto, VALORES_EXEMPLO);
}
