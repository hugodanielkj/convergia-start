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
import { enviarFormulario, liberarAteReuniao } from '../../testes/liberacao.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
let agenciaId: string;
let appAdmin: FastifyInstance;
let appPublico: FastifyInstance;

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  return construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
}

let n = 0;
async function novoCliente() {
  n += 1;
  const r = await appAdmin.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: `Lib ${String(n)}`,
      nomeContato: 'C',
      email: `l${String(n)}-${sufixo}@t.com`,
    },
  });
  return r.json<{ link: { token: string } }>().link.token;
}

interface Etapas {
  etapas: { etapa: string; liberada: boolean; feita: boolean; status: string }[];
  atual: string;
}
const etapas = async (token: string) =>
  (
    await appPublico.inject({ method: 'GET', url: `/publico/onboardings/${token}/etapas` })
  ).json<Etapas>();
const liberadas = (e: Etapas) => e.etapas.filter((x) => x.liberada).map((x) => x.etapa);
const reservar = (token: string, tipo: string) =>
  appPublico.inject({
    method: 'POST',
    url: `/publico/onboardings/${token}/agendamentos`,
    payload: { tipo, inicio: '2026-11-25T15:00:00.000Z' },
  });

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: 'Lib' } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const admin = await prisma.usuario.create({
    data: { agenciaId, nome: 'Admin', email: `adm-${sufixo}@ag.com`, papel: 'admin' },
  });
  appAdmin = construir(usuarioTeste({ agenciaId, id: admin.id }));
  appPublico = construir(null);
  await Promise.all([appAdmin.ready(), appPublico.ready()]);
});

afterAll(async () => {
  await Promise.all([appAdmin.close(), appPublico.close()]);
  await prisma.agencia.delete({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('RN-79 etapas liberadas na página do cliente', () => {
  it('no começo só o formulário, e a página abre nele', async () => {
    const token = await novoCliente();
    const r = await appPublico.inject({
      method: 'GET',
      url: `/publico/onboardings/${token}/etapas`,
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    const e = r.json<Etapas>();
    expect(liberadas(e)).toEqual(['formulario']);
    expect(e.atual).toBe('formulario');
    expect(e.etapas.map((x) => x.status)).toEqual(['pendente', 'pendente', 'pendente', 'pendente']);
  });

  it('formulário enviado libera Acessos e a página abre nela', async () => {
    const token = await novoCliente();
    await enviarFormulario(prisma, token);
    const e = await etapas(token);
    expect(liberadas(e)).toEqual(['formulario', 'acessos']);
    expect(e.atual).toBe('acessos');
  });

  it('acessos avisados liberam Reunião', async () => {
    const token = await novoCliente();
    await liberarAteReuniao(prisma, token);
    const e = await etapas(token);
    expect(liberadas(e)).toEqual(['formulario', 'acessos', 'reuniao']);
    expect(e.atual).toBe('reuniao');
  });

  it('link inválido não revela nada', async () => {
    const r = await appPublico.inject({ method: 'GET', url: '/publico/onboardings/xyz/etapas' });
    expect(r.statusCode).toBe(404);
  });
});

describe('RN-79 o servidor recusa ação em etapa bloqueada', () => {
  it('não agenda a reunião antes dos acessos', async () => {
    const token = await novoCliente();
    await enviarFormulario(prisma, token);
    const r = await reservar(token, 'reuniao');
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: string }>().erro).toBe('RN-79');
  });

  it('não agenda a captação antes da reunião', async () => {
    const token = await novoCliente();
    await liberarAteReuniao(prisma, token);
    const r = await reservar(token, 'captacao');
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: string }>().erro).toBe('RN-79');
  });
});
