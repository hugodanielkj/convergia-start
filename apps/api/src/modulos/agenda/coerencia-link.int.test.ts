import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import { adicionarDias, diaDaSemana } from '@convergia/core/agenda';
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
import { liberarAteReuniao } from '../../testes/liberacao.js';

// Coerência agenda × link do cliente: o que a agência configura em /config/agenda (horário padrão,
// exceção do dia, bloqueio e feriado) tem de ser exatamente o que o cliente vê para escolher.
// "Esperado" é calculado só com o que a agência enxerga pelas rotas de consulta da agenda; "visto"
// é o que a rota pública do link devolve. Qualquer diferença em qualquer dia reprova.
const prisma = criarPrisma(URL_BANCO_TESTE);
const apps: FastifyInstance[] = [];
const sufixo = randomUUID().slice(0, 8);
// Duração padrão de cada tipo na configuração da agência (minutos).
const DURACAO_PADRAO: Record<'reuniao' | 'captacao', number> = { reuniao: 60, captacao: 120 };
// AGORA_TESTE: segunda 16/11/2026 09:00 em Brasília; com 24h de antecedência o primeiro horário
// possível é terça 17/11 09:00.
const PRIMEIRO_HORARIO = '2026-11-17 09:00';
const DE = '2026-11-16';
const ATE = '2026-12-13';

let agencia: string;
let appAdmin: FastifyInstance;
let appPublico: FastifyInstance;
let token: string;

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
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

type Tipo = 'reuniao' | 'captacao';
interface Janela {
  tipo: Tipo;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  duracaoMinutos: number | null;
}
interface Excecao {
  tipo: Tipo;
  data: string;
  horaInicio: string;
  horaFim: string;
  duracaoMinutos: number | null;
}

const minutos = (hora: string): number => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const textoHora = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

async function consultar<T>(url: string): Promise<T> {
  const resposta = await appAdmin.inject({ method: 'GET', url });
  expect(resposta.statusCode).toBe(200);
  return resposta.json<T>();
}

/** Horários que a agência espera ver oferecidos por dia, lendo só o que o painel dela mostra. */
async function esperadoPelaAgencia(
  tipo: Tipo,
  ocupados: ReadonlySet<string>,
): Promise<Map<string, string[]>> {
  const [{ disponibilidades }, { excecoes }, { bloqueios }, f1, f2] = await Promise.all([
    consultar<{ disponibilidades: Janela[] }>('/agenda/disponibilidades'),
    consultar<{ excecoes: Excecao[] }>(`/agenda/excecoes?de=${DE}&ate=${ATE}`),
    consultar<{ bloqueios: { dataInicio: string; dataFim: string }[] }>('/agenda/bloqueios'),
    consultar<{ feriados: { data: string }[] }>('/agenda/feriados?ano=2026'),
    consultar<{ feriados: { data: string }[] }>('/agenda/feriados?ano=2027'),
  ]);
  const feriados = new Set([...f1.feriados, ...f2.feriados].map((f) => f.data));
  const porDia = new Map<string, string[]>();

  for (let dia = DE; dia <= ATE; dia = adicionarDias(dia, 1)) {
    const fechado =
      feriados.has(dia) || bloqueios.some((b) => b.dataInicio <= dia && dia <= b.dataFim);
    if (fechado) continue;
    const doDia = excecoes.filter((e) => e.tipo === tipo && e.data === dia);
    const janelas =
      doDia.length > 0
        ? doDia
        : disponibilidades.filter((j) => j.tipo === tipo && j.diaSemana === diaDaSemana(dia));
    const horas: string[] = [];
    for (const j of janelas) {
      const duracao = j.duracaoMinutos ?? DURACAO_PADRAO[tipo];
      for (let m = minutos(j.horaInicio); m + duracao <= minutos(j.horaFim); m += duracao) {
        const hora = textoHora(m);
        if (`${dia} ${hora}` < PRIMEIRO_HORARIO || ocupados.has(`${dia} ${hora}`)) continue;
        horas.push(hora);
      }
    }
    if (horas.length > 0) porDia.set(dia, horas.sort());
  }
  return porDia;
}

/** Horários que o cliente vê no link (rota pública), por dia. */
async function vistoNoLink(tipo: Tipo): Promise<Map<string, string[]>> {
  const resposta = await appPublico.inject({
    method: 'GET',
    url: `/publico/onboardings/${token}/slots?tipo=${tipo}&de=${DE}&ate=${ATE}`,
  });
  expect(resposta.statusCode).toBe(200);
  const { dias } = resposta.json<{ dias: { data: string; slots: { hora: string }[] }[] }>();
  return new Map(dias.map((d) => [d.data, d.slots.map((s) => s.hora).sort()]));
}

async function conferir(tipo: Tipo, ocupados: ReadonlySet<string> = new Set()): Promise<void> {
  const esperado = Object.fromEntries(await esperadoPelaAgencia(tipo, ocupados));
  const visto = Object.fromEntries(await vistoNoLink(tipo));
  expect(visto, `horários de ${tipo} no link diferem da agenda da agência`).toEqual(esperado);
}

const janela = (tipo: Tipo, diaSemana: number, horaInicio: string, horaFim: string) =>
  appAdmin.inject({
    method: 'POST',
    url: '/agenda/disponibilidades',
    payload: { tipo, diaSemana, horaInicio, horaFim },
  });

beforeAll(async () => {
  agencia = (await prisma.agencia.create({ data: { nome: 'Coerência' } })).id;
  await prisma.configAgencia.create({
    data: {
      agenciaId: agencia,
      ...CONFIG_PADRAO,
      duracaoReuniaoMinutos: DURACAO_PADRAO.reuniao,
      duracaoCaptacaoMinutos: DURACAO_PADRAO.captacao,
    },
  });
  const admin = await prisma.usuario.create({
    data: { agenciaId: agencia, nome: 'Admin', email: `c-${sufixo}@ag.com`, papel: 'admin' },
  });
  appAdmin = construir(usuarioTeste({ agenciaId: agencia, id: admin.id }));
  appPublico = construir(null);
  await Promise.all(apps.map((a) => a.ready()));

  // Padrão: reunião terça 09–10 (para o cliente marcar a dele) e quinta/sexta 13–17;
  // captação quinta e sexta 13–17.
  await janela('reuniao', 2, '09:00', '10:00');
  for (const dia of [4, 5]) {
    await janela('reuniao', dia, '13:00', '17:00');
    await janela('captacao', dia, '13:00', '17:00');
  }

  const criado = await appAdmin.inject({
    method: 'POST',
    url: '/clientes',
    payload: { nomeEmpresa: 'Cliente Coerência', nomeContato: 'C', email: `cli-${sufixo}@t.com` },
  });
  token = criado.json<{ link: { token: string } }>().link.token;
  await liberarAteReuniao(prisma, token);
});

afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: agencia } });
  await prisma.$disconnect();
});

describe('agenda da agência × horários do link do cliente', () => {
  it('captação na quinta das 13h às 17h aparece na quinta, e só nela e na sexta', async () => {
    // A captação só abre depois da reunião marcada (RN-39): o cliente marca a dele na terça 17/11.
    const reuniao = await appPublico.inject({
      method: 'POST',
      url: `/publico/onboardings/${token}/agendamentos`,
      payload: { tipo: 'reuniao', inicio: '2026-11-17T12:00:00.000Z' },
    });
    expect(reuniao.statusCode).toBe(201);

    const visto = await vistoNoLink('captacao');
    expect(visto.get('2026-11-19')).toEqual(['13:00', '15:00']); // quinta: 13–17 em blocos de 2h
    expect([...visto.keys()].every((d) => [4, 5].includes(diaDaSemana(d)))).toBe(true);
    await conferir('captacao');
  });

  it('reunião do padrão bate com o link em todos os dias (menos a já marcada)', async () => {
    await conferir('reuniao', new Set(['2026-11-17 09:00']));
  });

  it('exceção de um dia (sexta 14h–17h) muda o link só naquele dia', async () => {
    const r = await appAdmin.inject({
      method: 'PUT',
      url: '/agenda/excecoes',
      payload: {
        tipo: 'reuniao',
        data: '2026-11-27',
        janelas: [{ horaInicio: '14:00', horaFim: '17:00' }],
      },
    });
    expect(r.statusCode).toBe(200);
    const visto = await vistoNoLink('reuniao');
    expect(visto.get('2026-11-27')).toEqual(['14:00', '15:00', '16:00']);
    expect(visto.get('2026-12-04')).toEqual(['13:00', '14:00', '15:00', '16:00']);
    await conferir('reuniao', new Set(['2026-11-17 09:00']));
    await conferir('captacao'); // a exceção era só de reunião
  });

  it('bloqueio e feriado tiram o dia do link (20/11 é feriado nacional)', async () => {
    const b = await appAdmin.inject({
      method: 'POST',
      url: '/agenda/bloqueios',
      payload: { dataInicio: '2026-11-26', dataFim: '2026-11-26', motivo: 'folga' },
    });
    expect(b.statusCode).toBe(201);
    for (const tipo of ['reuniao', 'captacao'] as const) {
      const visto = await vistoNoLink(tipo);
      expect(visto.has('2026-11-26')).toBe(false);
      expect(visto.has('2026-11-20')).toBe(false);
      await conferir(tipo, new Set(['2026-11-17 09:00']));
    }
  });

  it('voltar ao padrão devolve ao link o horário original do dia', async () => {
    await appAdmin.inject({
      method: 'PUT',
      url: '/agenda/excecoes',
      payload: { tipo: 'reuniao', data: '2026-11-27', janelas: [] },
    });
    expect((await vistoNoLink('reuniao')).get('2026-11-27')).toEqual([
      '13:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
    await conferir('reuniao', new Set(['2026-11-17 09:00']));
  });

  it('sem nenhum horário cadastrado para o tipo, o link não oferece nada', async () => {
    await prisma.disponibilidade.deleteMany({ where: { agenciaId: agencia, tipo: 'captacao' } });
    expect((await vistoNoLink('captacao')).size).toBe(0);
    await conferir('captacao');
  });
});
