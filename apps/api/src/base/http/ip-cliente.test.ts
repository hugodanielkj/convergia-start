import { describe, expect, it } from 'vitest';
import { ehEnderecoPrivado } from './ip-cliente.js';

describe('ehEnderecoPrivado (RN-76)', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.4',
    '192.168.1.10',
    '::1',
    '::ffff:127.0.0.1',
    'fd00::1',
  ])('reconhece %s como rede interna', (ip) => {
    expect(ehEnderecoPrivado(ip)).toBe(true);
  });

  it.each(['203.0.113.1', '172.32.0.1', '2001:db8::1', '::ffff:8.8.8.8', 'lixo', undefined])(
    'não trata %s como interno',
    (ip) => {
      expect(ehEnderecoPrivado(ip)).toBe(false);
    },
  );
});
