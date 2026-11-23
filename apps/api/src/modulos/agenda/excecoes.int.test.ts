import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../testes/dependencias.js';
import { carregarContexto, listarSlots } from './slots-publicos.js';

// RN-30: horário padrão toda semana + exceção num dia específico (calendário da agenda).
const prisma = criarPrisma(URL_BANCO_TESTE);
const apps: FastifyInstance[] = [];
const sufixo = randomUUID().slice(0, 8);

let agencia: string;
let outraAgencia: string;
let appAdmin: FastifyInstance;
let appMembro: FastifyInstance;

function construir(usuario: UsuarioAutenticado): FastifyInstance {
  const app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
  apps.push(app);
  return app;
}

const definir = (app: FastifyInstance, corpo: unknown) =>
  app.inject({ method: 'PUT', url: '/agenda/excecoes', payload: corpo as object });

// Quinta 26/11 e sexta 27/11 de 2026, em horário de Brasília (UTC-3).
const sextaDaSemana = '2026-11-27';

beforeAll(async () => {
  agencia = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  outraAgencia = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  await prisma.configAgencia.create({
    data: { agenciaId: agencia, ...CONFIG_PADRAO, duracaoReuniaoMinutos: 40 },
  });
  const admin = await prisma.usuario.create({
    data: { agenciaId: agencia, nome: 'Admin', email: `a-${sufixo}@ag.com`, papel: 'admin' },
  });
  const membro = await prisma.usuario.create({
    data: { agenciaId: agencia, nome: 'Membro', email: `m-${sufixo}@ag.com`, papel: 'membro' },
  });
  appAdmin = construir(usuarioTeste({ agenciaId: agencia, id: admin.id }));
  appMembro = construir(usuarioTeste({ agenciaId: agencia, id: membro.id, papel: 'membro' }));
  await Promise.all(apps.map((a) => a.ready()));
  for (const diaSemana of [4, 5]) {
    await prisma.disponibilidade.create({
      data: {
        agenciaId: agencia,
        tipo: 'reuniao',
        diaSemana,
        horaInicio: '13:00',
        horaFim: '17:00',
      },
    });
  }
});

afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: { in: [agencia, outraAgencia] } } });
  await prisma.$disconnect();
});

async function horasDoDia(data: string): Promise<string[]> {
  const contexto = await carregarContexto(prisma, agencia);
  const lista = await listarSlots(
    contexto,
    { tipo: 'reuniao', de: data, ate: data, fuso: 'America/Sao_Paulo' },
    AGORA_TESTE,
  );
  return lista.dias.flatMap((d) => d.slots.map((s) => s.hora));
}

describe('exceção de um dia', () => {
  it('só o Admin define; membro recebe 403', async () => {
    const resposta = await definir(appMembro, {
      tipo: 'reuniao',
      data: sextaDaSemana,
      janelas: [{ horaInicio: '14:00', horaFim: '17:00' }],
    });
    expect(resposta.statusCode).toBe(403);
    // Consultar é para qualquer usuário logado.
    expect((await appMembro.inject({ method: 'GET', url: '/agenda/excecoes' })).statusCode).toBe(
      200,
    );
  });

  it('sem exceção, o dia usa o horário padrão', async () => {
    expect(await horasDoDia(sextaDaSemana)).toEqual([
      '13:00',
      '13:40',
      '14:20',
      '15:00',
      '15:40',
      '16:20',
    ]);
  });

  it('sexta das 14h às 17h: só aquele dia muda, a quinta continua no padrão', async () => {
    const resposta = await definir(appAdmin, {
      tipo: 'reuniao',
      data: sextaDaSemana,
      janelas: [{ horaInicio: '14:00', horaFim: '17:00' }],
    });
    expect(resposta.statusCode).toBe(200);
    expect(await horasDoDia(sextaDaSemana)).toEqual(['14:00', '14:40', '15:20', '16:00']);
    expect(await horasDoDia('2026-11-26')).toHaveLength(6);
    expect(await horasDoDia('2026-12-04')).toHaveLength(6); // sexta seguinte
  });

  it('redefinir troca o que havia; lista vazia volta ao padrão', async () => {
    await definir(appAdmin, {
      tipo: 'reuniao',
      data: sextaDaSemana,
      janelas: [
        { horaInicio: '09:00', horaFim: '10:00', duracaoMinutos: 30 },
        { horaInicio: '15:00', horaFim: '16:00', duracaoMinutos: 30 },
      ],
    });
    expect(await horasDoDia(sextaDaSemana)).toEqual(['09:00', '09:30', '15:00', '15:30']);

    const lista = (
      await appAdmin.inject({ method: 'GET', url: '/agenda/excecoes?de=2026-11-27&ate=2026-11-27' })
    ).json<{ hoje: string; excecoes: unknown[] }>();
    expect(lista.hoje).toBe('2026-11-16');
    expect(lista.excecoes).toHaveLength(2);

    await definir(appAdmin, { tipo: 'reuniao', data: sextaDaSemana, janelas: [] });
    expect(await horasDoDia(sextaDaSemana)).toHaveLength(6);
  });

  it('recusa dado inválido com 422 e código', async () => {
    const enviar = async (corpo: object) => {
      const r = await definir(appAdmin, { tipo: 'reuniao', data: sextaDaSemana, ...corpo });
      return [r.statusCode, r.json<{ codigo: string }>().codigo];
    };
    expect(await enviar({ janelas: [{ horaInicio: '17:00', horaFim: '14:00' }] })).toEqual([
      422,
      'intervalo_invalido',
    ]);
    expect(
      await enviar({
        janelas: [
          { horaInicio: '09:00', horaFim: '12:00' },
          { horaInicio: '11:00', horaFim: '13:00' },
        ],
      }),
    ).toEqual([422, 'sobreposicao']);
    expect(await enviar({ data: '2026-11-15', janelas: [] })).toEqual([422, 'data_passada']);
    expect(await enviar({ data: '2026-02-31', janelas: [] })).toEqual([422, 'data_invalida']);
  });

  it('não vaza nem altera exceções de outra agência (RN-75)', async () => {
    await prisma.disponibilidadeDia.create({
      data: {
        agenciaId: outraAgencia,
        tipo: 'reuniao',
        data: new Date(`${sextaDaSemana}T00:00:00.000Z`),
        horaInicio: '08:00',
        horaFim: '09:00',
      },
    });
    await definir(appAdmin, { tipo: 'reuniao', data: sextaDaSemana, janelas: [] });
    expect(await prisma.disponibilidadeDia.count({ where: { agenciaId: outraAgencia } })).toBe(1);
    const lista = (await appAdmin.inject({ method: 'GET', url: '/agenda/excecoes' })).json<{
      excecoes: unknown[];
    }>();
    expect(lista.excecoes).toHaveLength(0);
  });
});
