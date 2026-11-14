import type { UsuarioAutenticado } from '@convergia/core/base';
import {
  gerarChave,
  modeloPadrao,
  TIPOS_CAMPO,
  validarCampos,
  validarEvolucao,
  type CampoFormulario,
  type ErroModelo,
} from '@convergia/core/formulario';
import { Prisma } from '../../generated/prisma/client.js';
import { z } from 'zod';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

const campoSalvo = z.object({
  chave: z.string(),
  rotulo: z.string(),
  tipo: z.enum(TIPOS_CAMPO),
  obrigatorio: z.boolean(),
  arquivado: z.boolean(),
  ajuda: z.string().optional(),
  opcoes: z.array(z.string()).optional(),
});

/** Campo vindo da tela: campo novo ainda não tem chave (ela nasce do rótulo, RN-15). */
export const campoDeEntrada = z.object({
  chave: z.string().max(60).optional(),
  rotulo: z.string().max(200),
  tipo: z.string().max(40),
  obrigatorio: z.boolean().default(false),
  arquivado: z.boolean().default(false),
  ajuda: z.string().max(500).optional(),
  opcoes: z.array(z.string().max(200)).max(50).optional(),
});
export type CampoDeEntrada = z.infer<typeof campoDeEntrada>;

export interface EstadoModelo {
  versaoPublicada: { numero: number; publicadaEm: Date; campos: CampoFormulario[] };
  rascunho: CampoFormulario[];
  temAlteracoes: boolean;
}

export type ResultadoEdicao = { tipo: 'ok' } | { tipo: 'invalido'; erros: readonly ErroModelo[] };

export type ResultadoPublicacao =
  | { tipo: 'publicada'; numero: number }
  | { tipo: 'sem_alteracoes' }
  | { tipo: 'invalido'; erros: readonly ErroModelo[] };

export const lerCampos = (json: unknown): CampoFormulario[] => z.array(campoSalvo).parse(json);
const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const ator = (u: UsuarioAutenticado): string => `usuario:${u.id}`;

function jaExiste(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}

/** Garante a versão 1 (modelo padrão, RN-19). Concorrência: o índice único evita duplicar. */
export async function garantirModeloPadrao(
  prisma: PrismaDaAgencia,
  agenciaId: string,
): Promise<void> {
  if ((await prisma.versaoFormulario.count()) > 0) return;
  try {
    await prisma.$transaction([
      prisma.versaoFormulario.create({
        data: { agenciaId, numero: 1, campos: modeloPadrao() as unknown as Prisma.InputJsonValue },
      }),
      prisma.modeloFormulario.create({ data: { agenciaId } }),
      prisma.auditoriaLog.create({
        data: {
          agenciaId,
          ator: 'sistema',
          acao: 'formulario.modelo_padrao_criado',
          entidade: 'VersaoFormulario',
          entidadeId: agenciaId,
          dados: { numero: 1 },
        },
      }),
    ]);
  } catch (erro) {
    if (!jaExiste(erro)) throw erro;
  }
}

export async function obterModelo(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
): Promise<EstadoModelo> {
  await garantirModeloPadrao(prisma, usuario.agenciaId);
  const [versao, modelo] = await Promise.all([
    prisma.versaoFormulario.findFirstOrThrow({ orderBy: { numero: 'desc' } }),
    prisma.modeloFormulario.findFirstOrThrow(),
  ]);
  const campos = lerCampos(versao.campos);
  const rascunho = modelo.rascunho === null ? campos : lerCampos(modelo.rascunho);
  return {
    versaoPublicada: { numero: versao.numero, publicadaEm: versao.publicadaEm, campos },
    rascunho,
    temAlteracoes: !igual(rascunho, campos),
  };
}

export function completarCampos(entrada: readonly CampoDeEntrada[]): CampoFormulario[] {
  const chaves = entrada.flatMap((c) => (c.chave ? [c.chave] : []));
  return entrada.map((c): CampoFormulario => {
    const chave = c.chave ?? gerarChave(c.rotulo, chaves);
    if (!c.chave) chaves.push(chave);
    const base = {
      chave,
      rotulo: c.rotulo.trim(),
      // Tipo desconhecido é barrado pela validação do core (RN-16).
      tipo: c.tipo as CampoFormulario['tipo'],
      obrigatorio: c.obrigatorio,
      arquivado: c.arquivado,
    };
    const ajuda = c.ajuda?.trim();
    return {
      ...base,
      ...(ajuda ? { ajuda } : {}),
      ...(c.opcoes && c.opcoes.length > 0 ? { opcoes: c.opcoes.map((o) => o.trim()) } : {}),
    };
  });
}

export async function salvarRascunho(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  entrada: readonly CampoDeEntrada[],
): Promise<ResultadoEdicao> {
  const estado = await obterModelo(prisma, usuario);
  const campos = completarCampos(entrada);
  const erros = [
    ...validarCampos(campos),
    ...validarEvolucao(estado.versaoPublicada.campos, campos),
  ];
  if (erros.length > 0) return { tipo: 'invalido', erros };

  const volta = igual(campos, estado.versaoPublicada.campos);
  await prisma.modeloFormulario.update({
    where: { agenciaId: usuario.agenciaId },
    data: { rascunho: volta ? Prisma.DbNull : (campos as unknown as Prisma.InputJsonValue) },
  });
  return { tipo: 'ok' };
}

export async function publicarVersao(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
): Promise<ResultadoPublicacao> {
  const estado = await obterModelo(prisma, usuario);
  if (!estado.temAlteracoes) return { tipo: 'sem_alteracoes' };
  const erros = [
    ...validarCampos(estado.rascunho),
    ...validarEvolucao(estado.versaoPublicada.campos, estado.rascunho),
  ];
  if (erros.length > 0) return { tipo: 'invalido', erros };

  const numero = estado.versaoPublicada.numero + 1;
  await prisma.$transaction([
    prisma.versaoFormulario.create({
      data: {
        agenciaId: usuario.agenciaId,
        numero,
        campos: estado.rascunho as unknown as Prisma.InputJsonValue,
        publicadaPor: usuario.id,
      },
    }),
    prisma.modeloFormulario.update({
      where: { agenciaId: usuario.agenciaId },
      data: { rascunho: Prisma.DbNull },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: ator(usuario),
        acao: 'formulario.versao_publicada',
        entidade: 'VersaoFormulario',
        entidadeId: `${usuario.agenciaId}:${String(numero)}`,
        dados: { numero },
      },
    }),
  ]);
  return { tipo: 'publicada', numero };
}
