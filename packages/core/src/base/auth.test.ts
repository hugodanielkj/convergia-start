import { describe, expect, it } from 'vitest';
import { podeAlterarConfiguracoes, podeVerOnboarding } from './auth.js';

describe('RN-03 alteração de configurações', () => {
  it('permite ao admin', () => {
    expect(podeAlterarConfiguracoes({ papel: 'admin' })).toBe(true);
  });

  it('nega ao membro', () => {
    expect(podeAlterarConfiguracoes({ papel: 'membro' })).toBe(false);
  });
});

describe('RN-02 visibilidade de onboardings', () => {
  it('admin vê onboarding de qualquer responsável', () => {
    expect(podeVerOnboarding({ id: 'a', papel: 'admin' }, 'outro')).toBe(true);
  });

  it('membro vê onboarding do qual é responsável', () => {
    expect(podeVerOnboarding({ id: 'm', papel: 'membro' }, 'm')).toBe(true);
  });

  it('membro não vê onboarding de outro responsável', () => {
    expect(podeVerOnboarding({ id: 'm', papel: 'membro' }, 'outro')).toBe(false);
  });
});
