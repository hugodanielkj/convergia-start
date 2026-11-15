import { describe, expect, it } from 'vitest';
import {
  LIMITES_RESPOSTA,
  etapaConcluida,
  validarRespostas,
  type CampoFormulario,
  type Respostas,
} from './index.js';

const campo = (chave: string, extra: Partial<CampoFormulario> = {}): CampoFormulario => ({
  chave,
  rotulo: chave,
  tipo: 'texto_curto',
  obrigatorio: false,
  arquivado: false,
  ...extra,
});

const campos: CampoFormulario[] = [
  campo('empresa', { obrigatorio: true }),
  campo('sobre', { tipo: 'texto_longo' }),
  campo('funcionarios', { tipo: 'numero' }),
  campo('porte', { tipo: 'selecao_unica', opcoes: ['Pequeno', 'Grande'] }),
  campo('canais', { tipo: 'multipla_escolha', opcoes: ['Instagram', 'TikTok', 'Site'] }),
  campo('fundacao', { tipo: 'data' }),
  campo('site', { tipo: 'url' }),
  campo('antigo', { obrigatorio: true, arquivado: true }),
];

const completo = (respostas: Respostas) => validarRespostas(campos, respostas, { completo: true });
const rascunho = (respostas: Respostas) => validarRespostas(campos, respostas, { completo: false });

describe('RN-17 obrigatórios só valem no envio', () => {
  it('rascunho aceita formulário vazio ou parcial', () => {
    expect(rascunho({})).toEqual([]);
    expect(rascunho({ sobre: 'Somos uma padaria' })).toEqual([]);
  });

  it('envio exige os obrigatórios ativos preenchidos', () => {
    expect(completo({})).toEqual([{ chave: 'empresa', codigo: 'obrigatorio' }]);
    expect(completo({ empresa: '   ' })).toEqual([{ chave: 'empresa', codigo: 'obrigatorio' }]);
    expect(completo({ empresa: 'Padaria' })).toEqual([]);
  });

  it('campo arquivado nunca é exigido', () => {
    expect(completo({ empresa: 'Padaria' }).map((e) => e.chave)).not.toContain('antigo');
  });

  it('a etapa só está concluída com tudo obrigatório preenchido e válido', () => {
    expect(etapaConcluida(campos, {})).toBe(false);
    expect(etapaConcluida(campos, { empresa: 'Padaria', site: 'não é url' })).toBe(false);
    expect(etapaConcluida(campos, { empresa: 'Padaria' })).toBe(true);
  });
});

describe('RN-16 cada tipo valida o seu valor, até no rascunho', () => {
  it('número precisa ser número finito', () => {
    expect(rascunho({ funcionarios: 12 })).toEqual([]);
    expect(rascunho({ funcionarios: 'doze' })).toEqual([
      { chave: 'funcionarios', codigo: 'numero_invalido' },
    ]);
    expect(rascunho({ funcionarios: Number.NaN })).toEqual([
      { chave: 'funcionarios', codigo: 'numero_invalido' },
    ]);
  });

  it('data precisa existir no calendário (AAAA-MM-DD)', () => {
    expect(rascunho({ fundacao: '2020-02-29' })).toEqual([]);
    expect(rascunho({ fundacao: '2021-02-29' })).toEqual([
      { chave: 'fundacao', codigo: 'data_invalida' },
    ]);
    expect(rascunho({ fundacao: '29/02/2020' })).toEqual([
      { chave: 'fundacao', codigo: 'data_invalida' },
    ]);
  });

  it('URL precisa ser http ou https', () => {
    expect(rascunho({ site: 'https://padaria.com.br/menu' })).toEqual([]);
    expect(rascunho({ site: 'javascript:alert(1)' })).toEqual([
      { chave: 'site', codigo: 'url_invalida' },
    ]);
    expect(rascunho({ site: 'padaria.com.br' })).toEqual([
      { chave: 'site', codigo: 'url_invalida' },
    ]);
  });

  it('seleção única aceita só uma das opções', () => {
    expect(rascunho({ porte: 'Grande' })).toEqual([]);
    expect(rascunho({ porte: 'Médio' })).toEqual([{ chave: 'porte', codigo: 'opcao_invalida' }]);
    expect(rascunho({ porte: ['Grande'] })).toEqual([{ chave: 'porte', codigo: 'tipo_invalido' }]);
  });

  it('múltipla escolha aceita lista de opções sem repetir', () => {
    expect(rascunho({ canais: ['Instagram', 'Site'] })).toEqual([]);
    expect(rascunho({ canais: ['Instagram', 'Orkut'] })).toEqual([
      { chave: 'canais', codigo: 'opcao_invalida' },
    ]);
    expect(rascunho({ canais: ['Site', 'Site'] })).toEqual([
      { chave: 'canais', codigo: 'opcao_invalida' },
    ]);
    expect(rascunho({ canais: 'Site' })).toEqual([{ chave: 'canais', codigo: 'tipo_invalido' }]);
  });

  it('textos têm tamanho máximo', () => {
    expect(rascunho({ empresa: 'a'.repeat(LIMITES_RESPOSTA.textoCurto) })).toEqual([]);
    expect(rascunho({ empresa: 'a'.repeat(LIMITES_RESPOSTA.textoCurto + 1) })).toEqual([
      { chave: 'empresa', codigo: 'texto_longo_demais' },
    ]);
    expect(rascunho({ sobre: 'a'.repeat(LIMITES_RESPOSTA.textoLongo + 1) })).toEqual([
      { chave: 'sobre', codigo: 'texto_longo_demais' },
    ]);
  });

  it('recusa resposta para campo que não existe no modelo', () => {
    expect(rascunho({ inventado: 'x' })).toEqual([
      { chave: 'inventado', codigo: 'campo_desconhecido' },
    ]);
  });

  it('campo vazio vale como não respondido e não é validado', () => {
    expect(rascunho({ funcionarios: '', site: '', canais: [] })).toEqual([]);
  });
});
