import { describe, expect, it, vi } from 'vitest';
import type { AgendaApi, ResultadoGravacao } from './api';
import {
  processarBloqueio,
  processarExcecao,
  processarJanela,
  processarRemocao,
} from './processar';

const ok: ResultadoGravacao = { tipo: 'ok' };

function apiFalsa(parcial: Partial<AgendaApi>): AgendaApi {
  return {
    listarJanelas: vi.fn(),
    listarBloqueios: vi.fn(),
    listarFeriados: vi.fn(),
    listarExcecoes: vi.fn(),
    definirExcecao: vi.fn(() => Promise.resolve(ok)),
    criarJanela: vi.fn(() => Promise.resolve(ok)),
    removerJanela: vi.fn(() => Promise.resolve(ok)),
    criarBloqueio: vi.fn(() => Promise.resolve(ok)),
    removerBloqueio: vi.fn(() => Promise.resolve(ok)),
    ...parcial,
  };
}

function formulario(campos: Record<string, string | string[]>): FormData {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries(campos)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) dados.append(campo, v);
  }
  return dados;
}

const janela = {
  tipo: 'reuniao',
  diaSemana: ['1', '2', '3'],
  horaInicio: '09:00',
  horaFim: '12:00',
  duracaoMinutos: '',
};

describe('RN-30 janelas pela tela', () => {
  it('cria uma janela para cada dia marcado', async () => {
    const criarJanela = vi.fn<AgendaApi['criarJanela']>(() => Promise.resolve(ok));
    expect(await processarJanela(formulario(janela), apiFalsa({ criarJanela }))).toEqual({
      tipo: 'salva',
      quantidade: 3,
    });
    expect(criarJanela.mock.calls.map(([j]) => j.diaSemana)).toEqual([1, 2, 3]);
    expect(criarJanela.mock.calls[0]?.[0]).toEqual({
      tipo: 'reuniao',
      diaSemana: 1,
      horaInicio: '09:00',
      horaFim: '12:00',
    });
  });

  it('envia a duração quando informada', async () => {
    const criarJanela = vi.fn<AgendaApi['criarJanela']>(() => Promise.resolve(ok));
    await processarJanela(
      formulario({ ...janela, diaSemana: '4', duracaoMinutos: '45' }),
      apiFalsa({ criarJanela }),
    );
    expect(criarJanela).toHaveBeenCalledWith(expect.objectContaining({ duracaoMinutos: 45 }));
  });

  it('exige tipo e pelo menos um dia, sem chamar a API', async () => {
    const criarJanela = vi.fn<AgendaApi['criarJanela']>();
    const api = apiFalsa({ criarJanela });
    expect(await processarJanela(formulario({ ...janela, tipo: 'jantar' }), api)).toMatchObject({
      tipo: 'erro',
      mensagem: /reunião ou captação/,
    });
    expect(await processarJanela(formulario({ ...janela, diaSemana: [] }), api)).toMatchObject({
      tipo: 'erro',
      mensagem: /dia da semana/,
    });
    expect(criarJanela).not.toHaveBeenCalled();
  });

  it('para no primeiro dia recusado, diz qual foi e quantos já ficaram salvos', async () => {
    const criarJanela = vi
      .fn<AgendaApi['criarJanela']>()
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ tipo: 'recusado', codigo: 'sobreposicao' });
    const estado = await processarJanela(formulario(janela), apiFalsa({ criarJanela }));
    expect(estado).toMatchObject({
      tipo: 'erro',
      mensagem: expect.stringMatching(/Terça: .*se sobrepõe.*1 dia\(s\) anterior/) as string,
    });
    expect(criarJanela).toHaveBeenCalledTimes(2);
  });

  it('preserva o que foi digitado quando dá erro', async () => {
    const api = apiFalsa({
      criarJanela: () =>
        Promise.resolve({ tipo: 'falha', mensagem: 'Só o Admin pode alterar a agenda.' }),
    });
    const estado = await processarJanela(formulario(janela), api);
    expect(estado).toMatchObject({
      tipo: 'erro',
      valores: { horaInicio: '09:00', dias: ['1', '2', '3'] },
      mensagem: 'Segunda: Só o Admin pode alterar a agenda.',
    });
  });

  it('trata queda de rede', async () => {
    const api = apiFalsa({ criarJanela: () => Promise.reject(new Error('ECONNREFUSED')) });
    expect(await processarJanela(formulario(janela), api)).toMatchObject({
      tipo: 'erro',
      mensagem: expect.stringMatching(/servidor/) as string,
    });
  });
});

describe('RN-44 bloqueios pela tela', () => {
  const bloqueio = { dataInicio: '2026-12-28', dataFim: '2027-01-02', motivo: 'Recesso' };

  it('grava o bloqueio', async () => {
    const criarBloqueio = vi.fn<AgendaApi['criarBloqueio']>(() => Promise.resolve(ok));
    expect(await processarBloqueio(formulario(bloqueio), apiFalsa({ criarBloqueio }))).toEqual({
      tipo: 'salvo',
    });
    expect(criarBloqueio).toHaveBeenCalledWith(bloqueio);
  });

  it('sem data final, o bloqueio é de um dia só', async () => {
    const criarBloqueio = vi.fn<AgendaApi['criarBloqueio']>(() => Promise.resolve(ok));
    await processarBloqueio(formulario({ ...bloqueio, dataFim: '' }), apiFalsa({ criarBloqueio }));
    expect(criarBloqueio).toHaveBeenCalledWith({ ...bloqueio, dataFim: '2026-12-28' });
  });

  it('mostra o erro da regra e preserva os valores', async () => {
    const api = apiFalsa({
      criarBloqueio: () => Promise.resolve({ tipo: 'recusado', codigo: 'motivo_obrigatorio' }),
    });
    expect(await processarBloqueio(formulario({ ...bloqueio, motivo: '' }), api)).toMatchObject({
      tipo: 'erro',
      valores: { dataInicio: '2026-12-28' },
      mensagem: 'Informe o motivo do bloqueio.',
    });
  });

  it('trata queda de rede', async () => {
    const api = apiFalsa({ criarBloqueio: () => Promise.reject(new Error('rede')) });
    expect(await processarBloqueio(formulario(bloqueio), api)).toMatchObject({ tipo: 'erro' });
  });
});

describe('remover janela ou bloqueio', () => {
  it('chama a remoção certa conforme o alvo', async () => {
    const removerJanela = vi.fn<AgendaApi['removerJanela']>(() => Promise.resolve(ok));
    const removerBloqueio = vi.fn<AgendaApi['removerBloqueio']>(() => Promise.resolve(ok));
    const api = apiFalsa({ removerJanela, removerBloqueio });
    expect(await processarRemocao(formulario({ id: 'j1', alvo: 'janela' }), api)).toEqual({
      tipo: 'inicial',
    });
    expect(await processarRemocao(formulario({ id: 'b1', alvo: 'bloqueio' }), api)).toEqual({
      tipo: 'inicial',
    });
    expect(removerJanela).toHaveBeenCalledWith('j1');
    expect(removerBloqueio).toHaveBeenCalledWith('b1');
  });

  it('recusa formulário incompleto, sem chamar a API', async () => {
    const removerJanela = vi.fn<AgendaApi['removerJanela']>();
    const api = apiFalsa({ removerJanela });
    expect(await processarRemocao(formulario({ id: 'j1', alvo: 'outro' }), api)).toMatchObject({
      tipo: 'erro',
    });
    expect(await processarRemocao(formulario({ alvo: 'janela' }), api)).toMatchObject({
      tipo: 'erro',
    });
    expect(removerJanela).not.toHaveBeenCalled();
  });

  it('mostra o motivo quando a API recusa e trata queda de rede', async () => {
    const recusa = apiFalsa({
      removerJanela: () =>
        Promise.resolve({ tipo: 'falha', mensagem: 'Só o Admin pode alterar a agenda.' }),
    });
    expect(await processarRemocao(formulario({ id: 'j1', alvo: 'janela' }), recusa)).toEqual({
      tipo: 'erro',
      mensagem: 'Só o Admin pode alterar a agenda.',
    });
    const caiu = apiFalsa({ removerBloqueio: () => Promise.reject(new Error('rede')) });
    expect(await processarRemocao(formulario({ id: 'b1', alvo: 'bloqueio' }), caiu)).toMatchObject({
      tipo: 'erro',
    });
  });
});

describe('RN-30 horário de um dia pelo calendário', () => {
  const base = { tipo: 'reuniao', data: '2026-11-27' };

  it('envia um horário por linha do formulário', async () => {
    const definirExcecao = vi.fn<AgendaApi['definirExcecao']>(() => Promise.resolve(ok));
    const estado = await processarExcecao(
      formulario({
        ...base,
        horaInicio: ['09:00', '14:00'],
        horaFim: ['10:00', '17:00'],
        duracaoMinutos: ['', '30'],
      }),
      apiFalsa({ definirExcecao }),
    );
    expect(estado).toEqual({ tipo: 'salva', padrao: false });
    expect(definirExcecao).toHaveBeenCalledWith({
      ...base,
      janelas: [
        { horaInicio: '09:00', horaFim: '10:00' },
        { horaInicio: '14:00', horaFim: '17:00', duracaoMinutos: 30 },
      ],
    });
  });

  it('"voltar ao padrão" manda a lista vazia', async () => {
    const definirExcecao = vi.fn<AgendaApi['definirExcecao']>(() => Promise.resolve(ok));
    const estado = await processarExcecao(
      formulario({ ...base, acao: 'padrao', horaInicio: '09:00', horaFim: '10:00' }),
      apiFalsa({ definirExcecao }),
    );
    expect(estado).toEqual({ tipo: 'salva', padrao: true });
    expect(definirExcecao).toHaveBeenCalledWith({ ...base, janelas: [] });
  });

  it('sem nenhum horário e sem pedir o padrão, avisa em vez de apagar', async () => {
    const definirExcecao = vi.fn<AgendaApi['definirExcecao']>(() => Promise.resolve(ok));
    const estado = await processarExcecao(formulario(base), apiFalsa({ definirExcecao }));
    expect(estado.tipo).toBe('erro');
    expect(definirExcecao).not.toHaveBeenCalled();
  });

  it('traduz a recusa da API e a falha de rede', async () => {
    const recusa = await processarExcecao(
      formulario({ ...base, horaInicio: '17:00', horaFim: '14:00' }),
      apiFalsa({
        definirExcecao: () => Promise.resolve({ tipo: 'recusado', codigo: 'intervalo_invalido' }),
      }),
    );
    expect(recusa).toEqual({ tipo: 'erro', mensagem: 'O fim precisa ser depois do início.' });
    const queda = await processarExcecao(
      formulario({ ...base, horaInicio: '09:00', horaFim: '10:00' }),
      apiFalsa({ definirExcecao: () => Promise.reject(new Error('x')) }),
    );
    expect(queda.tipo).toBe('erro');
  });
});
