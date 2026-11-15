import { describe, expect, it } from 'vitest';
import { descreverDataEtapa, formatarDia } from './formatar';

const FUSO = 'America/Sao_Paulo';

describe('RN-14 datas do resumo', () => {
  it('mostra o dia no fuso da agência, mesmo quando em UTC já é o dia seguinte', () => {
    expect(formatarDia('2026-11-11T01:30:00.000Z', FUSO)).toBe('10 de nov. de 2026');
  });

  it('formulário e acessos mostram o dia; reunião e captação, dia e hora', () => {
    const iso = '2026-11-12T17:00:00.000Z';
    expect(descreverDataEtapa('formulario', iso, FUSO)).toBe('Enviado em 12 de nov. de 2026');
    expect(descreverDataEtapa('acessos', iso, FUSO)).toBe('Concedidos em 12 de nov. de 2026');
    expect(descreverDataEtapa('reuniao', iso, FUSO)).toBe('12 de nov. de 2026, às 14:00');
    expect(descreverDataEtapa('captacao', iso, FUSO)).toBe('12 de nov. de 2026, às 14:00');
  });

  it('sem data registrada, só diz que a etapa foi concluída', () => {
    expect(descreverDataEtapa('acessos', null, FUSO)).toBe('Concluída');
  });
});
