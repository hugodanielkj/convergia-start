'use client';

import { createContext, useContext } from 'react';

export interface AvancoEtapa {
  /**
   * A etapa terminou sem erro nem falta de informação: recarrega os dados e leva o cliente à
   * próxima etapa (RN-79). Na última etapa, só recarrega.
   */
  avancar: () => void;
}

export const ContextoAvanco = createContext<AvancoEtapa>({ avancar: () => undefined });

/** Contrato da casca para as etapas (S6-4). As etapas não conhecem a ordem: só avisam que acabaram. */
export const useAvancoEtapa = (): AvancoEtapa => useContext(ContextoAvanco);
