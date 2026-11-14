import { describe, expect, it } from 'vitest';
import { chaveDoArquivo, detectarTipo, nomeSeguro, validarUpload } from './index.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PDF = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ');
const WEBP = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
const GIF = new TextEncoder().encode('GIF89a\0\0');
const HTML = new TextEncoder().encode('<html><script>alert(1)</script>');

const config = { tamanhoMaxMb: 1, tiposPermitidos: ['image/png', 'image/jpeg', 'application/pdf'] };
const arquivo = (bytes: Uint8Array, extra = {}) => ({
  nome: 'logo.png',
  tipoDeclarado: 'image/png',
  tamanho: bytes.length,
  inicio: bytes,
  ...extra,
});

describe('RN-20 tipo detectado pelo conteúdo, não pelo que o cliente diz', () => {
  it('reconhece PNG, JPEG, PDF, WebP e GIF pela assinatura dos primeiros bytes', () => {
    expect(detectarTipo(PNG)).toBe('image/png');
    expect(detectarTipo(JPEG)).toBe('image/jpeg');
    expect(detectarTipo(PDF)).toBe('application/pdf');
    expect(detectarTipo(WEBP)).toBe('image/webp');
    expect(detectarTipo(GIF)).toBe('image/gif');
  });

  it('não reconhece HTML, texto nem arquivo vazio', () => {
    expect(detectarTipo(HTML)).toBeNull();
    expect(detectarTipo(new Uint8Array())).toBeNull();
  });
});

describe('RN-20 validação no servidor', () => {
  it('aceita arquivo de tipo permitido e dentro do limite', () => {
    expect(validarUpload(arquivo(PNG), config)).toEqual({
      ok: true,
      tipo: 'image/png',
      nome: 'logo.png',
    });
  });

  it('recusa arquivo vazio', () => {
    const r = validarUpload(arquivo(new Uint8Array()), config);
    expect(r).toEqual({ ok: false, erro: 'vazio' });
  });

  it('recusa acima do limite configurado e aceita exatamente no limite', () => {
    const limite = 1024 * 1024;
    expect(validarUpload(arquivo(PNG, { tamanho: limite + 1 }), config)).toEqual({
      ok: false,
      erro: 'grande_demais',
    });
    expect(validarUpload(arquivo(PNG, { tamanho: limite }), config).ok).toBe(true);
  });

  it('o limite vem da configuração da agência', () => {
    const maior = { ...config, tamanhoMaxMb: 20 };
    expect(validarUpload(arquivo(PNG, { tamanho: 5 * 1024 * 1024 }), maior).ok).toBe(true);
  });

  it('recusa tipo que a agência não permite, mesmo sendo um tipo conhecido', () => {
    const r = validarUpload(arquivo(GIF, { tipoDeclarado: 'image/gif' }), config);
    expect(r).toEqual({ ok: false, erro: 'tipo_nao_permitido' });
  });

  it('recusa conteúdo que não bate com o tipo declarado (ex.: HTML disfarçado de PNG)', () => {
    expect(validarUpload(arquivo(HTML), config)).toEqual({ ok: false, erro: 'tipo_nao_permitido' });
    expect(validarUpload(arquivo(PDF), config)).toEqual({
      ok: false,
      erro: 'conteudo_diferente_do_declarado',
    });
  });

  it('aceita quando o cliente não informa o tipo, usando o detectado', () => {
    expect(
      validarUpload(arquivo(JPEG, { tipoDeclarado: undefined, nome: 'foto.jpg' }), config),
    ).toEqual({
      ok: true,
      tipo: 'image/jpeg',
      nome: 'foto.jpg',
    });
  });
});

describe('RN-69 nome e chave de armazenamento', () => {
  it('tira pastas, caracteres de controle e limita o tamanho do nome', () => {
    expect(nomeSeguro('../../etc/passwd')).toBe('passwd');
    expect(nomeSeguro('C:\\fotos\\logo final.png')).toBe('logo final.png');
    expect(nomeSeguro('a\u0000b\nc.png')).toBe('abc.png');
    expect(nomeSeguro('')).toBe('arquivo');
    expect(nomeSeguro(`${'x'.repeat(300)}.png`).length).toBeLessThanOrEqual(120);
  });

  it('organiza por agência e cliente, sem usar o nome enviado', () => {
    expect(
      chaveDoArquivo({ agenciaId: 'ag', clienteId: 'cli', arquivoId: 'arq', tipo: 'image/png' }),
    ).toBe('ag/cli/arq.png');
    expect(
      chaveDoArquivo({
        agenciaId: 'ag',
        clienteId: 'cli',
        arquivoId: 'arq',
        tipo: 'application/pdf',
      }),
    ).toBe('ag/cli/arq.pdf');
  });
});
