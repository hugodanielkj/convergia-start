import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../../app.js';
import { criarPrisma } from '../../../base/prisma.js';
import { AGORA_TESTE, URL_BANCO_TESTE, dependenciasDeTeste } from '../../../testes/dependencias.js';
import { assinar } from './assinatura.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const URL = '/publico/webhooks/meta-whatsapp';
const SEGREDO = 'segredo-do-app';
let app: FastifyInstance;
let agenciaId: string;
let onboardingId: string;
const telefone = `55319${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Ag ${sufixo}` } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const responsavel = await prisma.usuario.create({
    data: { agenciaId, nome: 'Ana', email: `ana-${sufixo}@x.com`, papel: 'admin' },
  });
  const cliente = await prisma.cliente.create({
    data: { agenciaId, nomeEmpresa: 'Loja', nomeContato: 'Bia', whatsapp: `+${telefone}` },
  });
  onboardingId = (
    await prisma.onboarding.create({
      data: { agenciaId, clienteId: cliente.id, responsavelId: responsavel.id },
    })
  ).id;
  app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      webhookWhatsapp: { verifyToken: 'verifica', appSecret: SEGREDO },
    }),
  );
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.agencia.deleteMany({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

const enviar = (corpo: unknown, assinatura?: string) => {
  const texto = JSON.stringify(corpo);
  return app.inject({
    method: 'POST',
    url: URL,
    headers: {
      'content-type': 'application/json',
      ...(assinatura === undefined ? {} : { 'x-hub-signature-256': assinatura }),
    },
    payload: texto,
  });
};
const assinado = (corpo: unknown) => assinar(JSON.stringify(corpo), SEGREDO);

describe('RN-61 webhook da Meta', () => {
  it('GET devolve o challenge só com o token certo', async () => {
    const ok = await app.inject({
      method: 'GET',
      url: `${URL}?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=123`,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe('123');
    const errado = await app.inject({
      method: 'GET',
      url: `${URL}?hub.mode=subscribe&hub.verify_token=x&hub.challenge=123`,
    });
    expect(errado.statusCode).toBe(403);
  });

  it('POST sem assinatura ou com assinatura inválida é recusado e nada muda', async () => {
    const corpo = { entry: [] };
    expect((await enviar(corpo)).statusCode).toBe(401);
    expect((await enviar(corpo, assinar('outro', SEGREDO))).statusCode).toBe(401);
  });

  it('RN-62 entrega que falhou marca a notificação como falhou', async () => {
    const n = await prisma.notificacao.create({
      data: {
        agenciaId,
        onboardingId,
        tipo: 'convite',
        categoria: 'transacional',
        chave: `k-${sufixo}`,
        corpo: 'Oi',
        status: 'enviada',
        idExterno: `wamid.${sufixo}`,
      },
    });
    const corpo = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: `wamid.${sufixo}`, status: 'failed', errors: [{ code: 131026 }] }],
              },
            },
          ],
        },
      ],
    };
    expect((await enviar(corpo, assinado(corpo))).statusCode).toBe(200);
    expect(await prisma.notificacao.findUniqueOrThrow({ where: { id: n.id } })).toMatchObject({
      status: 'falhou',
      erro: 'meta_entrega_131026',
    });
  });

  it('RN-61 "PARAR" recebido desativa os lembretes do cliente e cancela os pendentes', async () => {
    const lembrete = await prisma.notificacao.create({
      data: {
        agenciaId,
        onboardingId,
        tipo: 'lembrete_pendencia',
        categoria: 'lembrete',
        chave: `l-${sufixo}`,
        corpo: 'Falta pouco',
      },
    });
    const corpo = {
      entry: [
        {
          changes: [
            { value: { messages: [{ from: telefone, type: 'text', text: { body: 'PARAR' } }] } },
          ],
        },
      ],
    };
    expect((await enviar(corpo, assinado(corpo))).statusCode).toBe(200);
    const pref = await prisma.preferenciaEnvio.findUniqueOrThrow({ where: { onboardingId } });
    expect(pref.lembretesDesativadosEm).not.toBeNull();
    expect(
      (await prisma.notificacao.findUniqueOrThrow({ where: { id: lembrete.id } })).status,
    ).toBe('cancelada');
  });
});
