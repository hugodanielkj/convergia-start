import { NaoEncontradoError, ProibidoError, RegraVioladaError } from '@convergia/core/base';
import Fastify from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { registrarTratamentoDeErros } from './erros.js';

const app = Fastify({ logger: false });
registrarTratamentoDeErros(app);
app.get('/regra', () => {
  throw new RegraVioladaError('RN-07', 'Cliente já tem onboarding ativo');
});
app.get('/zod', () => z.object({ nome: z.string() }).parse({}));
app.get('/404', () => {
  throw new NaoEncontradoError('Cliente');
});
app.get('/403', () => {
  throw new ProibidoError('RN-02');
});
app.get(
  '/fastify-400',
  { schema: { querystring: { type: 'object', required: ['q'] } } },
  () => 'ok',
);
app.get('/500', () => {
  throw new Error('detalhe interno que não pode vazar');
});

describe('tratamento de erros', () => {
  afterAll(() => app.close());

  it.each([
    ['/regra', 422, { erro: 'RN-07', mensagem: 'Cliente já tem onboarding ativo' }],
    ['/zod', 400, { erro: 'VALIDACAO' }],
    ['/404', 404, { erro: 'NAO_ENCONTRADO', mensagem: 'Cliente não encontrado' }],
    ['/403', 403, { erro: 'RN-02' }],
    ['/fastify-400', 400, { erro: 'REQUISICAO' }],
    ['/500', 500, { erro: 'INTERNO', mensagem: 'Erro interno' }],
  ])('%s responde %i', async (url, status, corpo) => {
    const r = await app.inject(url);
    expect(r.statusCode).toBe(status);
    expect(r.json()).toMatchObject(corpo);
  });

  it('não vaza detalhes de erro inesperado', async () => {
    expect((await app.inject('/500')).body).not.toContain('detalhe interno');
  });
});
