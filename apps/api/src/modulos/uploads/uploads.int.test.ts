import type { UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArmazenamentoEmMemoria } from '../../adapters/storage/em-memoria.js';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import { URL_BANCO_TESTE, dependenciasDeTeste, usuarioTeste } from '../../testes/dependencias.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const storage = new ArmazenamentoEmMemoria();
let agenciaA: string;
let agenciaB: string;
let clienteA: string;
let appA: FastifyInstance;
let appB: FastifyInstance;
let semLogin: FastifyInstance;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  return construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      armazenamento: storage,
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
}

/** Corpo multipart montado à mão, para não depender de biblioteca extra nos testes. */
function multipart(nome: string, tipo: string, conteudo: Buffer) {
  const limite = '----convergia';
  const corpo = Buffer.concat([
    Buffer.from(
      `--${limite}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: ${tipo}\r\n\r\n`,
    ),
    conteudo,
    Buffer.from(`\r\n--${limite}--\r\n`),
  ]);
  return { payload: corpo, headers: { 'content-type': `multipart/form-data; boundary=${limite}` } };
}

const enviar = (app: FastifyInstance, clienteId: string, nome: string, tipo: string, c: Buffer) =>
  app.inject({
    method: 'POST',
    url: `/clientes/${clienteId}/arquivos`,
    ...multipart(nome, tipo, c),
  });

beforeAll(async () => {
  agenciaA = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  agenciaB = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  await prisma.configAgencia.create({
    data: {
      agenciaId: agenciaA,
      prazoProducaoDiasUteis: 5,
      validadeLinkDias: 14,
      antecedenciaMinimaHoras: 24,
      intervaloReuniaoCaptacaoDiasMin: 1,
      limiteReagendamentos: 2,
      antecedenciaReagendamentoHoras: 24,
      duracaoReuniaoMinutos: 60,
      duracaoCaptacaoMinutos: 120,
      lembretesPendenciaDias: [1],
      maxLembretesPendencia: 3,
      lembretesCompromissoHoras: [24],
      janelaEnvioInicio: '08:00',
      janelaEnvioFim: '20:00',
      diasEnvioPermitidos: [1],
      canalNotificacaoPadrao: 'whatsapp',
      intervaloMinimoReenvioHoras: 24,
      diasSemAcaoParaAlerta: 3,
      diasConclusaoAutomatica: 7,
      plataformasObrigatorias: [],
      uploadTamanhoMaxMb: 1,
      uploadTiposPermitidos: ['image/png', 'application/pdf'],
      permitirCredenciais: false,
    },
  });
  clienteA = (
    await prisma.cliente.create({
      data: { agenciaId: agenciaA, nomeEmpresa: 'Padaria', nomeContato: 'Maria', email: 'm@x.com' },
    })
  ).id;
  appA = construir(usuarioTeste({ agenciaId: agenciaA, id: 'usuario-a' }));
  appB = construir(usuarioTeste({ agenciaId: agenciaB, id: 'usuario-b' }));
  semLogin = construir(null);
  await Promise.all([appA.ready(), appB.ready(), semLogin.ready()]);
});

afterAll(async () => {
  await Promise.all([appA.close(), appB.close(), semLogin.close()]);
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaA, agenciaB] } } });
  await prisma.$disconnect();
});

describe('RN-20 upload validado no servidor', () => {
  it('guarda o arquivo válido por agência e cliente (RN-69) e audita (RN-77)', async () => {
    const r = await enviar(appA, clienteA, 'logo.png', 'image/png', PNG);
    expect(r.statusCode).toBe(201);
    const { arquivo } = r.json<{ arquivo: { id: string; tipo: string; tamanho: number } }>();
    expect(arquivo).toMatchObject({ tipo: 'image/png', tamanho: PNG.length });

    const salvo = await prisma.arquivo.findUniqueOrThrow({ where: { id: arquivo.id } });
    expect(salvo.chave).toBe(`${agenciaA}/${clienteA}/${arquivo.id}.png`);
    expect(Buffer.from((await storage.ler(salvo.chave)) ?? [])).toEqual(PNG);

    const auditoria = await prisma.auditoriaLog.findMany({
      where: { agenciaId: agenciaA, acao: 'arquivo.enviado', entidadeId: arquivo.id },
    });
    expect(auditoria).toHaveLength(1);
  });

  it('recusa HTML disfarçado de PNG e não grava nada', async () => {
    const antes = await prisma.arquivo.count({ where: { agenciaId: agenciaA } });
    const r = await enviar(appA, clienteA, 'logo.png', 'image/png', HTML);
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: string }>().erro).toBe('tipo_nao_permitido');
    expect(await prisma.arquivo.count({ where: { agenciaId: agenciaA } })).toBe(antes);
  });

  it('recusa tipo que a agência não permite (GIF), mesmo sendo GIF de verdade', async () => {
    const gif = Buffer.from('GIF89a\0\0\0\0');
    const r = await enviar(appA, clienteA, 'a.gif', 'image/gif', gif);
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: string }>().erro).toBe('tipo_nao_permitido');
  });

  it('recusa conteúdo diferente do tipo declarado', async () => {
    const pdf = Buffer.from('%PDF-1.7\n....');
    const r = await enviar(appA, clienteA, 'logo.png', 'image/png', pdf);
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: string }>().erro).toBe('conteudo_diferente_do_declarado');
  });

  it('recusa arquivo acima do limite da agência (413)', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]);
    const r = await enviar(appA, clienteA, 'grande.png', 'image/png', grande);
    expect(r.statusCode).toBe(413);
    expect(r.json<{ erro: string }>().erro).toBe('grande_demais');
  });

  it('recusa arquivo vazio e requisição sem arquivo', async () => {
    const vazio = await enviar(appA, clienteA, 'vazio.png', 'image/png', Buffer.alloc(0));
    expect(vazio.statusCode).toBe(422);
    const sem = await appA.inject({ method: 'POST', url: `/clientes/${clienteA}/arquivos` });
    expect(sem.statusCode).toBe(400);
  });

  it('exige login', async () => {
    const r = await enviar(semLogin, clienteA, 'logo.png', 'image/png', PNG);
    expect(r.statusCode).toBe(401);
  });
});

describe('RN-75 isolamento e download', () => {
  it('outra agência não envia para o cliente nem baixa o arquivo', async () => {
    const envio = await enviar(appB, clienteA, 'logo.png', 'image/png', PNG);
    expect(envio.statusCode).toBe(404);

    const { id } = await prisma.arquivo.findFirstOrThrow({ where: { agenciaId: agenciaA } });
    expect((await appB.inject({ method: 'GET', url: `/arquivos/${id}` })).statusCode).toBe(404);
  });

  it('a agência baixa com cabeçalhos seguros', async () => {
    const { id } = await prisma.arquivo.findFirstOrThrow({ where: { agenciaId: agenciaA } });
    const r = await appA.inject({ method: 'GET', url: `/arquivos/${id}` });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(String(r.headers['content-disposition'])).toContain('attachment');
    expect(r.rawPayload).toEqual(PNG);
  });
});
