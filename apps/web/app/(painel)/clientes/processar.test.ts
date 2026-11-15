import { describe, expect, it, vi } from 'vitest';
import type { ClienteApi, ResultadoCadastro, ResultadoLink } from './api';
import { lerValores, processarCadastro, processarNovoLink } from './processar';

const link = { token: 'tok', caminho: '/o/tok', expiraEm: '2026-11-30T12:00:00.000Z' };

function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries(campos)) dados.set(campo, valor);
  return dados;
}

function apiFalsa(parcial: Partial<ClienteApi>): ClienteApi {
  return {
    listar: vi.fn(),
    cadastrar: vi.fn(),
    regenerarLink: vi.fn(),
    ...parcial,
  };
}

const preenchido = formulario({
  nomeEmpresa: 'Padaria',
  nomeContato: 'Maria',
  whatsapp: '(31) 99999-8888',
  email: '',
});
const valores = {
  nomeEmpresa: 'Padaria',
  nomeContato: 'Maria',
  whatsapp: '(31) 99999-8888',
  email: '',
  enviarConviteDepois: false,
};

describe('lerValores', () => {
  it('lê só texto e trata campo ausente como vazio', () => {
    const dados = new FormData();
    dados.set('nomeEmpresa', 'Loja');
    dados.set('whatsapp', new File(['x'], 'x.txt'));
    expect(lerValores(dados)).toEqual({
      nomeEmpresa: 'Loja',
      nomeContato: '',
      whatsapp: '',
      email: '',
      enviarConviteDepois: false,
    });
  });

  it('RN-09: lê a marcação "Enviar convite depois"', () => {
    const dados = new FormData();
    dados.set('enviarConviteDepois', 'on');
    expect(lerValores(dados).enviarConviteDepois).toBe(true);
  });
});

describe('RN-04, RN-05, RN-07 cadastro pela tela', () => {
  it('mostra o link quando cria', async () => {
    const cadastrar = vi.fn<ClienteApi['cadastrar']>(() =>
      Promise.resolve<ResultadoCadastro>({
        tipo: 'criado',
        cliente: {
          id: 'c1',
          nomeEmpresa: 'Padaria',
          nomeContato: 'Maria',
          whatsapp: null,
          email: null,
          criadoEm: 'x',
          onboarding: null,
        },
        link,
        convite: { enviaEm: '2026-11-16T12:00:00.000Z' },
      }),
    );
    expect(await processarCadastro(preenchido, apiFalsa({ cadastrar }))).toEqual({
      tipo: 'criado',
      nomeEmpresa: 'Padaria',
      link,
      convite: { enviaEm: '2026-11-16T12:00:00.000Z' },
    });
    expect(cadastrar).toHaveBeenCalledWith({ ...valores, confirmarDuplicidade: false });
  });

  it('marca cada campo com a primeira mensagem de erro', async () => {
    const cadastrar = vi.fn<ClienteApi['cadastrar']>(() =>
      Promise.resolve<ResultadoCadastro>({
        tipo: 'invalido',
        erros: [
          { campo: 'nomeEmpresa', codigo: 'obrigatorio' },
          { campo: 'whatsapp', codigo: 'ddd_invalido' },
          { campo: 'whatsapp', codigo: 'telefone_invalido' },
        ],
      }),
    );
    const estado = await processarCadastro(preenchido, apiFalsa({ cadastrar }));
    expect(estado).toEqual({
      tipo: 'invalido',
      valores,
      erros: {
        nomeEmpresa: 'Preencha este campo.',
        whatsapp: 'DDD inexistente. Confira o número.',
      },
    });
  });

  it('avisa da duplicidade e mantém o que foi digitado', async () => {
    const cadastrar = vi.fn<ClienteApi['cadastrar']>(() =>
      Promise.resolve<ResultadoCadastro>({
        tipo: 'duplicado',
        duplicidades: [{ nomeEmpresa: 'Padaria Antiga', motivos: ['whatsapp', 'email'] }],
      }),
    );
    expect(await processarCadastro(preenchido, apiFalsa({ cadastrar }))).toEqual({
      tipo: 'duplicado',
      valores,
      avisos: ['Padaria Antiga tem o mesmo e-mail e WhatsApp.'],
    });
  });

  it('"Cadastrar mesmo assim" reenvia confirmando a duplicidade', async () => {
    const cadastrar = vi.fn<ClienteApi['cadastrar']>(() =>
      Promise.resolve<ResultadoCadastro>({ tipo: 'falha', mensagem: 'x' }),
    );
    const confirmado = formulario({
      nomeEmpresa: 'Padaria',
      nomeContato: 'Maria',
      confirmarDuplicidade: 'true',
    });
    await processarCadastro(confirmado, apiFalsa({ cadastrar }));
    expect(cadastrar).toHaveBeenCalledWith(expect.objectContaining({ confirmarDuplicidade: true }));
  });

  it('só confirma com o valor exato "true"', async () => {
    const cadastrar = vi.fn<ClienteApi['cadastrar']>(() =>
      Promise.resolve<ResultadoCadastro>({ tipo: 'falha', mensagem: 'x' }),
    );
    await processarCadastro(formulario({ confirmarDuplicidade: 'sim' }), apiFalsa({ cadastrar }));
    expect(cadastrar).toHaveBeenCalledWith(
      expect.objectContaining({ confirmarDuplicidade: false }),
    );
  });

  it('repassa a falha da API e trata queda de rede sem perder o formulário', async () => {
    const falha = apiFalsa({
      cadastrar: () => Promise.resolve({ tipo: 'falha', mensagem: 'Sem permissão.' }),
    });
    expect(await processarCadastro(preenchido, falha)).toEqual({
      tipo: 'falha',
      valores,
      mensagem: 'Sem permissão.',
    });

    const caiu = apiFalsa({ cadastrar: () => Promise.reject(new Error('ECONNREFUSED')) });
    expect(await processarCadastro(preenchido, caiu)).toMatchObject({
      tipo: 'falha',
      valores,
      mensagem: expect.stringMatching(/servidor/) as string,
    });
  });
});

describe('RN-12 novo link pela tela', () => {
  it('mostra o link gerado', async () => {
    const regenerarLink = vi.fn<ClienteApi['regenerarLink']>(() =>
      Promise.resolve<ResultadoLink>({ tipo: 'gerado', link }),
    );
    expect(
      await processarNovoLink(formulario({ onboardingId: 'ob1' }), apiFalsa({ regenerarLink })),
    ).toEqual({ tipo: 'gerado', link });
    expect(regenerarLink).toHaveBeenCalledWith('ob1');
  });

  it('recusa formulário sem onboarding, sem chamar a API', async () => {
    const regenerarLink = vi.fn<ClienteApi['regenerarLink']>();
    expect(await processarNovoLink(new FormData(), apiFalsa({ regenerarLink }))).toMatchObject({
      tipo: 'falha',
    });
    expect(regenerarLink).not.toHaveBeenCalled();
  });

  it('repassa a falha da API e trata queda de rede', async () => {
    const recusou = apiFalsa({
      regenerarLink: () => Promise.resolve({ tipo: 'falha', mensagem: 'Encerrado.' }),
    });
    expect(await processarNovoLink(formulario({ onboardingId: 'ob1' }), recusou)).toEqual({
      tipo: 'falha',
      mensagem: 'Encerrado.',
    });

    const caiu = apiFalsa({ regenerarLink: () => Promise.reject(new Error('rede')) });
    expect(await processarNovoLink(formulario({ onboardingId: 'ob1' }), caiu)).toMatchObject({
      tipo: 'falha',
    });
  });
});
