import { describe, expect, it, vi } from 'vitest';
import { criarClienteApi, ErroApi, type DadosCadastro } from './api';

const dados: DadosCadastro = {
  nomeEmpresa: 'Padaria',
  nomeContato: 'Maria',
  whatsapp: '(31) 99999-8888',
  email: '',
  confirmarDuplicidade: false,
};
const cliente = {
  id: 'c1',
  nomeEmpresa: 'Padaria',
  nomeContato: 'Maria',
  whatsapp: '+5531999998888',
  email: null,
  criadoEm: '2026-11-16T12:00:00.000Z',
  onboarding: null,
};
const link = { token: 'tok', caminho: '/o/tok', expiraEm: '2026-11-30T12:00:00.000Z' };

function api(status: number, corpo: unknown, cabecalhos?: Record<string, string>) {
  const fetcher = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })),
  );
  return {
    fetcher,
    cliente: criarClienteApi({
      baseUrl: 'http://api',
      fetcher,
      ...(cabecalhos ? { cabecalhos } : {}),
    }),
  };
}

describe('listar clientes', () => {
  it('lê a lista da API', async () => {
    const { cliente: c, fetcher } = api(200, { clientes: [cliente] });
    expect(await c.listar()).toEqual([cliente]);
    expect(fetcher).toHaveBeenCalledWith(
      'http://api/clientes',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('repassa o cookie de sessão do usuário', async () => {
    const { cliente: c, fetcher } = api(200, { clientes: [] }, { cookie: 'sessao=abc' });
    await c.listar();
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ cookie: 'sessao=abc' });
  });

  it('falha quando a API devolve erro ou formato inesperado', async () => {
    await expect(api(500, { erro: 'INTERNO' }).cliente.listar()).rejects.toThrow(ErroApi);
    await expect(api(200, { clientes: [{ id: 1 }] }).cliente.listar()).rejects.toThrow(/formato/);
  });
});

describe('cadastrar cliente', () => {
  it('devolve o cliente e o link quando cria', async () => {
    const { cliente: c, fetcher } = api(201, { cliente, link });
    expect(await c.cadastrar(dados)).toEqual({ tipo: 'criado', cliente, link });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual(dados);
  });

  it('devolve os erros de validação (RN-04, RN-05)', async () => {
    const erros = [{ campo: 'whatsapp', codigo: 'ddd_invalido', regra: 'RN-05' }];
    expect(await api(422, { erro: 'CADASTRO_INVALIDO', erros }).cliente.cadastrar(dados)).toEqual({
      tipo: 'invalido',
      erros: [{ campo: 'whatsapp', codigo: 'ddd_invalido' }],
    });
  });

  it('devolve o alerta de duplicidade (RN-07)', async () => {
    const duplicidades = [{ clienteId: 'c9', nomeEmpresa: 'Outra', motivos: ['email'] }];
    const resultado = await api(409, { erro: 'RN-07', duplicidades }).cliente.cadastrar(dados);
    expect(resultado).toEqual({
      tipo: 'duplicado',
      duplicidades: [{ nomeEmpresa: 'Outra', motivos: ['email'] }],
    });
  });

  it.each([400, 401, 403])('transforma %i em mensagem para o usuário', async (status) => {
    const resultado = await api(status, { erro: 'X' }).cliente.cadastrar(dados);
    expect(resultado.tipo).toBe('falha');
  });

  it('falha em erro inesperado do servidor', async () => {
    await expect(api(500, { erro: 'INTERNO' }).cliente.cadastrar(dados)).rejects.toThrow(ErroApi);
  });
});

describe('regenerar link (RN-12)', () => {
  it('devolve o novo link', async () => {
    const { cliente: c, fetcher } = api(200, { link });
    expect(await c.regenerarLink('ob/1')).toEqual({ tipo: 'gerado', link });
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://api/onboardings/ob%2F1/link/regenerar');
  });

  it.each([
    [403, /Admin ou o responsável/],
    [404, /não encontrado/],
    [422, /encerrado/],
  ])('explica o erro %i', async (status, mensagem) => {
    const resultado = await api(status, { erro: 'X' }).cliente.regenerarLink('ob1');
    expect(resultado).toMatchObject({
      tipo: 'falha',
      mensagem: expect.stringMatching(mensagem) as string,
    });
  });

  it('falha em erro inesperado do servidor', async () => {
    await expect(api(502, undefined).cliente.regenerarLink('ob1')).rejects.toThrow(ErroApi);
  });
});
