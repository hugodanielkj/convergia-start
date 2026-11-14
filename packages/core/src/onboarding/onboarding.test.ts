import { describe, expect, it } from 'vitest';
import {
  criarEtapasIniciais,
  ETAPAS_ONBOARDING,
  onboardingAtivo,
  STATUS_ONBOARDING,
  type StatusOnboarding,
} from './index.js';

describe('RN-06 etapas iniciais do onboarding', () => {
  it('tem as quatro etapas, na ordem da jornada do cliente', () => {
    expect(ETAPAS_ONBOARDING).toEqual(['formulario', 'acessos', 'reuniao', 'captacao']);
  });

  it('cria as quatro etapas todas pendentes', () => {
    expect(criarEtapasIniciais()).toEqual([
      { tipo: 'formulario', status: 'pendente' },
      { tipo: 'acessos', status: 'pendente' },
      { tipo: 'reuniao', status: 'pendente' },
      { tipo: 'captacao', status: 'pendente' },
    ]);
  });

  it('devolve uma lista nova a cada chamada, sem compartilhar estado', () => {
    const primeira = criarEtapasIniciais();
    const segunda = criarEtapasIniciais();
    expect(primeira).not.toBe(segunda);
    expect(primeira[0]).not.toBe(segunda[0]);
  });
});

describe('RN-07 onboarding ativo', () => {
  it('lista todos os status da RN-49, incluindo os laterais', () => {
    expect(STATUS_ONBOARDING).toEqual([
      'criado',
      'convite_enviado',
      'em_andamento',
      'aguardando_agendamentos',
      'aguardando_reuniao',
      'aguardando_captacao',
      'em_producao',
      'primeiro_conteudo_entregue',
      'concluido',
      'pausado',
      'cancelado',
    ]);
  });

  it.each<StatusOnboarding>(['concluido', 'cancelado'])('%s encerra o onboarding', (status) => {
    expect(onboardingAtivo(status)).toBe(false);
  });

  it.each(STATUS_ONBOARDING.filter((s) => s !== 'concluido' && s !== 'cancelado'))(
    '%s ainda conta como ativo',
    (status) => {
      expect(onboardingAtivo(status)).toBe(true);
    },
  );

  it('pausado continua ativo: reabrir não pode gerar um segundo onboarding', () => {
    expect(onboardingAtivo('pausado')).toBe(true);
  });
});
