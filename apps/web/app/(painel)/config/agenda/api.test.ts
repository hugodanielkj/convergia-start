import { describe, expect, it, vi } from 'vitest';
import { criarAgendaApi, ErroApi } from './api';

function api(status: number, corpo?: unknown) {
  const fetcher = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })),
  );
  return {
    fetcher,
    cliente: criarAgendaApi({
      baseUrl: 'http://api',
      fetcher,
      cabecalhos: { cookie: 'sessao=abc' },
    }),
  };
}

const janela = {
  id: 'j1',
  tipo: 'reuniao',
  diaSemana: 1,
  horaInicio: '09:00',
  horaFim: '12:00',
  duracaoMinutos: null,
  usuarioId: null,
};
const bloqueio = { id: 'b1', dataInicio: '2026-11-10', dataFim: '2026-11-10', motivo: 'Folga' };

describe('consultas', () => {
  it('lê janelas, bloqueios e feriados repassando o cookie', async () => {
    const a = api(200, { disponibilidades: [janela] });
    expect(await a.cliente.listarJanelas()).toEqual([janela]);
    expect(a.fetcher.mock.calls[0]?.[0]).toBe('http://api/agenda/disponibilidades');
    expect(a.fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ cookie: 'sessao=abc' });

    expect(await api(200, { bloqueios: [bloqueio] }).cliente.listarBloqueios()).toEqual([bloqueio]);
    expect(
      await api(200, {
        feriados: [{ data: '2026-09-07', nome: 'Independência do Brasil' }],
      }).cliente.listarFeriados(),
    ).toHaveLength(1);
  });

  it('falha em erro do servidor ou formato inesperado', async () => {
    await expect(api(500).cliente.listarJanelas()).rejects.toThrow(ErroApi);
    await expect(
      api(200, { disponibilidades: [{ id: 1 }] }).cliente.listarJanelas(),
    ).rejects.toThrow(/formato/);
  });
});

describe('gravações', () => {
  const dados = { tipo: 'reuniao', diaSemana: 1, horaInicio: '09:00', horaFim: '12:00' } as const;

  it('cria e remove', async () => {
    const criar = api(201, { disponibilidade: janela });
    expect(await criar.cliente.criarJanela(dados)).toEqual({ tipo: 'ok' });
    expect(
      JSON.parse(
        typeof criar.fetcher.mock.calls[0]?.[1]?.body === 'string'
          ? criar.fetcher.mock.calls[0][1].body
          : '',
      ),
    ).toEqual(dados);

    const remover = api(204);
    expect(await remover.cliente.removerJanela('a/b')).toEqual({ tipo: 'ok' });
    expect(remover.fetcher.mock.calls[0]?.[0]).toBe('http://api/agenda/disponibilidades/a%2Fb');
    expect(await api(204).cliente.removerBloqueio('b1')).toEqual({ tipo: 'ok' });
    expect(
      await api(201, { bloqueio }).cliente.criarBloqueio({
        dataInicio: '2026-11-10',
        dataFim: '2026-11-10',
        motivo: 'Folga',
      }),
    ).toEqual({ tipo: 'ok' });
  });

  it('devolve o código quando a regra recusa', async () => {
    expect(
      await api(422, { erro: 'JANELA_INVALIDA', codigo: 'intervalo_invalido' }).cliente.criarJanela(
        dados,
      ),
    ).toEqual({ tipo: 'recusado', codigo: 'intervalo_invalido' });
  });

  it('trata o conflito de janela (RN-30), que não traz código, como sobreposição', async () => {
    expect(await api(422, { erro: 'RN-30', mensagem: 'x' }).cliente.criarJanela(dados)).toEqual({
      tipo: 'recusado',
      codigo: 'sobreposicao',
    });
  });

  it.each([
    [401, /Admin/],
    [403, /Admin/],
    [404, /não existe mais/],
    [400, /Confira/],
  ])('transforma %i em mensagem', async (status, mensagem) => {
    expect(
      await api(status, { erro: 'X' }).cliente.criarBloqueio({
        dataInicio: 'a',
        dataFim: 'b',
        motivo: 'c',
      }),
    ).toMatchObject({
      tipo: 'falha',
      mensagem: expect.stringMatching(mensagem) as string,
    });
  });

  it('falha em erro inesperado', async () => {
    await expect(api(500).cliente.criarJanela(dados)).rejects.toThrow(ErroApi);
  });
});
