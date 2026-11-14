import { feriadosNacionais } from '@convergia/core/agenda';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  exigirAdmin,
  exigirUsuario,
  prismaDaRequisicao,
  usuarioDaRequisicao,
} from '../../base/auth.js';
import { criarBloqueio, listarBloqueios, removerBloqueio } from './bloqueios.js';
import {
  criarDisponibilidade,
  listarDisponibilidades,
  removerDisponibilidade,
} from './disponibilidades.js';

const idDaRota = z.object({ id: z.string().min(1).max(64) });

// Os limites só barram entradas absurdas; as regras de conteúdo são do core (RN-30, RN-44).
const corpoDisponibilidade = z.object({
  tipo: z.enum(['reuniao', 'captacao']),
  diaSemana: z.number(),
  horaInicio: z.string().max(10),
  horaFim: z.string().max(10),
  duracaoMinutos: z.number().nullish(),
  usuarioId: z.string().min(1).max(64).nullish(),
});

const corpoBloqueio = z.object({
  dataInicio: z.string().max(10),
  dataFim: z.string().max(10),
  motivo: z.string().max(1000),
});

const consultaFeriados = z.object({ ano: z.coerce.number().int().min(1900).max(2200).optional() });

/** Ano corrente no fuso da agência (D-14): perto da virada, o ano em UTC pode estar adiantado. */
function anoNoFuso(instante: Date, fuso: string): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric' }).format(instante),
  );
}

/**
 * Módulo agenda (S2-5): disponibilidade, bloqueios e feriados. Consultar é para qualquer usuário
 * logado; cadastrar e remover é só do Admin (RN-03).
 */
export default function agenda(app: FastifyInstance): Promise<void> {
  app.get('/agenda/disponibilidades', { preHandler: exigirUsuario }, async (request) => ({
    disponibilidades: await listarDisponibilidades(prismaDaRequisicao(app, request)),
  }));

  app.post('/agenda/disponibilidades', { preHandler: exigirAdmin }, async (request, reply) => {
    const corpo = corpoDisponibilidade.parse(request.body);
    const resultado = await criarDisponibilidade(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      {
        ...corpo,
        duracaoMinutos: corpo.duracaoMinutos ?? undefined,
        usuarioId: corpo.usuarioId ?? undefined,
      },
    );
    if (resultado.tipo === 'invalida') {
      return reply.status(422).send({ erro: 'JANELA_INVALIDA', codigo: resultado.codigo });
    }
    return reply.status(201).send({ disponibilidade: resultado.disponibilidade });
  });

  app.delete(
    '/agenda/disponibilidades/:id',
    { preHandler: exigirAdmin },
    async (request, reply) => {
      const { id } = idDaRota.parse(request.params);
      await removerDisponibilidade(
        prismaDaRequisicao(app, request),
        usuarioDaRequisicao(request),
        id,
      );
      return reply.status(204).send();
    },
  );

  app.get('/agenda/bloqueios', { preHandler: exigirUsuario }, async (request) => ({
    bloqueios: await listarBloqueios(prismaDaRequisicao(app, request)),
  }));

  app.post('/agenda/bloqueios', { preHandler: exigirAdmin }, async (request, reply) => {
    const corpo = corpoBloqueio.parse(request.body);
    const resultado = await criarBloqueio(
      prismaDaRequisicao(app, request),
      usuarioDaRequisicao(request),
      corpo,
    );
    if (resultado.tipo === 'invalido') {
      return reply.status(422).send({ erro: 'BLOQUEIO_INVALIDO', codigo: resultado.codigo });
    }
    return reply.status(201).send({ bloqueio: resultado.bloqueio });
  });

  app.delete('/agenda/bloqueios/:id', { preHandler: exigirAdmin }, async (request, reply) => {
    const { id } = idDaRota.parse(request.params);
    await removerBloqueio(prismaDaRequisicao(app, request), usuarioDaRequisicao(request), id);
    return reply.status(204).send();
  });

  app.get('/agenda/feriados', { preHandler: exigirUsuario }, async (request) => {
    const { ano } = consultaFeriados.parse(request.query);
    const { fusoHorario } = await app.deps.prisma.agencia.findUniqueOrThrow({
      where: { id: usuarioDaRequisicao(request).agenciaId },
      select: { fusoHorario: true },
    });
    return { feriados: feriadosNacionais(ano ?? anoNoFuso(app.deps.relogio.agora(), fusoHorario)) };
  });

  return Promise.resolve();
}
