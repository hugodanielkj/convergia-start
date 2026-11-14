import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarBarramentoEmMemoria } from '../../base/eventos.js';
import { criarPrisma } from '../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../testes/dependencias.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const apps: FastifyInstance[] = [];
const sufixo = randomUUID().slice(0, 8);

let agenciaId: string;
let admin: FastifyInstance;
let publico: FastifyInstance;

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  const deps = dependenciasDeTeste({
    prisma,
    eventos: criarBarramentoEmMemoria((erro) => {
      throw erro;
    }),
    relogio: relogioFixo(AGORA_TESTE),
    resolverSessao: () => Promise.resolve(usuario),
  });
  const app = construirApp({ LOG_LEVEL: 'silent' }, deps);
  apps.push(app);
  return app;
}

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Cap ${sufixo}` } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const adm = await prisma.usuario.create({
    data: { agenciaId, nome: 'Admin', email: `adm-${sufixo}@cap.com`, papel: 'admin' },
  });
  admin = construir(usuarioTeste({ agenciaId, id: adm.id }));
  publico = construir(null);
  await Promise.all(apps.map((a) => a.ready()));
  for (const tipo of ['reuniao', 'captacao']) {
    for (const diaSemana of [1, 2, 3, 4, 5]) {
      await admin.inject({
        method: 'POST',
        url: '/agenda/disponibilidades',
        payload: {
          tipo,
          diaSemana,
          horaInicio: '09:00',
          horaFim: tipo === 'reuniao' ? '12:00' : '18:00',
        },
      });
    }
  }
});

afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await prisma.agencia.delete({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

let n = 0;
async function novoCliente() {
  n += 1;
  const r = await admin.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: `Cap ${String(n)}`,
      nomeContato: 'C',
      email: `c${String(n)}-${sufixo}@t.com`,
    },
  });
  return r.json<{ link: { token: string } }>().link.token;
}

const situacao = (token: string) =>
  publico.inject({ method: 'GET', url: `/publico/onboardings/${token}/captacao` });
const horarios = (token: string, de = '2026-11-17', ate = '2026-11-19') =>
  publico.inject({
    method: 'GET',
    url: `/publico/onboardings/${token}/slots?tipo=captacao&de=${de}&ate=${ate}`,
  });
const reservar = (token: string, tipo: string, inicio: string, extra: object = {}) =>
  publico.inject({
    method: 'POST',
    url: `/publico/onboardings/${token}/agendamentos`,
    payload: { tipo, inicio, ...extra },
  });

interface Dias {
  dias: { data: string; slots: { inicio: string }[] }[];
}
/** Primeiro horário livre do tipo, opcionalmente a partir de uma data (só há um profissional). */
async function primeiroSlot(
  token: string,
  tipo: string,
  aPartirDe = '2026-11-16',
): Promise<string> {
  const r = await publico.inject({
    method: 'GET',
    url: `/publico/onboardings/${token}/slots?tipo=${tipo}&de=${aPartirDe}&ate=2026-12-20`,
  });
  const inicio = r.json<Dias>().dias[0]?.slots[0]?.inicio;
  if (!inicio) throw new Error(`sem horário de ${tipo}`);
  return inicio;
}
/** Cliente com a reunião já marcada; devolve o token e o início da reunião. */
async function clienteComReuniao() {
  const token = await novoCliente();
  const reuniao = await primeiroSlot(token, 'reuniao');
  expect((await reservar(token, 'reuniao', reuniao)).statusCode).toBe(201);
  return { token, reuniao };
}
const DADOS = { captacao: { presencial: true, local: 'Rua A, 10', contatoLocal: 'Ana' } };

const diaLocal = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

describe('RN-39 captação depende da reunião', () => {
  it('fica bloqueada, sem horários, enquanto a reunião não foi agendada', async () => {
    const token = await novoCliente();
    const r = await situacao(token);
    expect(r.json()).toMatchObject({ situacao: 'bloqueada', intervaloDiasMin: 1 });
    expect(r.json<{ motivoBloqueio: string }>().motivoBloqueio).toMatch(/reunião/);
    expect((await horarios(token)).json<{ dias: unknown[] }>().dias).toEqual([]);
  });

  it('recusa a reserva da captação sem reunião', async () => {
    const token = await novoCliente();
    const r = await reservar(token, 'captacao', '2026-11-20T12:00:00.000Z', DADOS);
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ erro: 'SLOT_INDISPONIVEL' });
  });

  it('libera só horários depois do intervalo mínimo após a reunião', async () => {
    const { token, reuniao } = await clienteComReuniao();
    expect((await situacao(token)).json()).toMatchObject({ situacao: 'pendente' });

    const dias = (await horarios(token, '2026-11-16', '2026-11-30')).json<Dias>().dias;
    expect(dias.length).toBeGreaterThan(0);
    for (const dia of dias) expect(dia.data > diaLocal(reuniao)).toBe(true);

    // Mesmo dia da reunião: a janela de captação cobre o dia todo, mas o intervalo barra.
    const mesmoDia = new Date(new Date(reuniao).getTime() + 5 * 60 * 60 * 1000).toISOString();
    expect((await reservar(token, 'captacao', mesmoDia, DADOS)).statusCode).toBe(409);
    const livre = await primeiroSlot(token, 'captacao');
    expect((await reservar(token, 'captacao', livre, DADOS)).statusCode).toBe(201);
  });
});

describe('RN-40 dados da captação', () => {
  it('exige o local quando é presencial e não cria o agendamento', async () => {
    const { token } = await clienteComReuniao();
    const livre = await primeiroSlot(token, 'captacao');
    const r = await reservar(token, 'captacao', livre, { captacao: { presencial: true } });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({
      erro: 'DADOS_CAPTACAO_INVALIDOS',
      motivo: 'local_obrigatorio',
    });
    expect((await situacao(token)).json()).toMatchObject({ situacao: 'pendente' });
  });

  it('exige os dados da captação', async () => {
    const { token } = await clienteComReuniao();
    const r = await reservar(token, 'captacao', await primeiroSlot(token, 'captacao'));
    expect(r.statusCode).toBe(422);
  });

  it('guarda local, contato e observações e devolve na situação', async () => {
    const { token } = await clienteComReuniao();
    const livre = await primeiroSlot(token, 'captacao');
    await reservar(token, 'captacao', livre, {
      captacao: { ...DADOS.captacao, observacoes: 'Filmar a vitrine' },
    });
    const s = (await situacao(token)).json<{
      situacao: string;
      agendamento: { inicio: string; dados: unknown };
    }>();
    expect(s.situacao).toBe('agendada');
    expect(s.agendamento.inicio).toBe(livre);
    expect(s.agendamento.dados).toEqual({
      presencial: true,
      local: 'Rua A, 10',
      contatoLocal: 'Ana',
      observacoes: 'Filmar a vitrine',
    });
  });
});

describe('RN-41 e RN-33 regras de agendamento na captação', () => {
  it('reagendar a captação também respeita o intervalo da reunião', async () => {
    const { token, reuniao } = await clienteComReuniao();
    await reservar(token, 'captacao', await primeiroSlot(token, 'captacao'), DADOS);
    const lista = await publico.inject({
      method: 'GET',
      url: `/publico/onboardings/${token}/agendamentos`,
    });
    const id = lista
      .json<{ agendamentos: { id: string; tipo: string }[] }>()
      .agendamentos.find((a) => a.tipo === 'captacao')?.id;
    const reagendar = (inicio: string) =>
      publico.inject({
        method: 'POST',
        url: `/publico/onboardings/${token}/agendamentos/${id ?? ''}/reagendar`,
        payload: { inicio },
      });
    const mesmoDia = new Date(new Date(reuniao).getTime() + 5 * 60 * 60 * 1000).toISOString();
    expect((await reagendar(mesmoDia)).statusCode).toBe(409);
    const outro = (await horarios(token, '2026-11-16', '2026-11-30')).json<Dias>().dias.at(-1)
      ?.slots[0]?.inicio;
    expect((await reagendar(outro ?? '')).statusCode).toBe(200);
  });

  it('o mesmo horário não vai para dois clientes', async () => {
    const a = await clienteComReuniao();
    const b = await clienteComReuniao();
    const alvo = await primeiroSlot(a.token, 'captacao');
    const [ra, rb] = await Promise.all([
      reservar(a.token, 'captacao', alvo, DADOS),
      reservar(b.token, 'captacao', alvo, DADOS),
    ]);
    expect([ra.statusCode, rb.statusCode].sort()).toEqual([201, 409]);
  });
});
