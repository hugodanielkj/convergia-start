import type { PrismaClient } from './prisma.js';

/** Modelos sem `agenciaId`. Todo o resto é escopado por agência por padrão (RN-75). */
const MODELOS_GLOBAIS = new Set(['Agencia']);

const COM_WHERE = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

type Args = Record<string, unknown>;

const comAgencia = (valor: unknown, agenciaId: string): Args => ({
  ...(valor as Args | undefined),
  agenciaId,
});

/** Injeta `agenciaId` no filtro e nos dados da operação. Exportada para teste. */
export function aplicarEscopo(operacao: string, args: Args, agenciaId: string): Args {
  if (COM_WHERE.has(operacao)) {
    return { ...args, where: comAgencia(args['where'], agenciaId) };
  }
  switch (operacao) {
    case 'create':
      return { ...args, data: comAgencia(args['data'], agenciaId) };
    case 'createMany':
    case 'createManyAndReturn': {
      const dados = args['data'];
      const lista = Array.isArray(dados) ? (dados as unknown[]) : [dados];
      return { ...args, data: lista.map((d) => comAgencia(d, agenciaId)) };
    }
    case 'upsert':
      return {
        ...args,
        where: comAgencia(args['where'], agenciaId),
        create: comAgencia(args['create'], agenciaId),
      };
    default:
      throw new Error(`Operação "${operacao}" não suportada no escopo de agência`);
  }
}

/**
 * Cliente Prisma que só enxerga e grava dados de uma agência (RN-75).
 * Use sempre este cliente em código de módulo; o cliente cru só em seed e testes.
 */
export function escopoAgencia(prisma: PrismaClient, agenciaId: string) {
  return prisma.$extends({
    name: 'escopo-agencia',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (MODELOS_GLOBAIS.has(model)) return query(args);
          return query(aplicarEscopo(operation, args, agenciaId));
        },
      },
    },
  });
}

export type PrismaDaAgencia = ReturnType<typeof escopoAgencia>;
