'use client';

import { createContext, useContext } from 'react';

export type EtapaId = 'formulario' | 'acessos' | 'reuniao' | 'captacao';

export interface PassoEtapa {
  etapa: EtapaId;
  /** Posição na ordem da casca (RN-79), começando em 1. */
  numero: number;
  total: number;
}

/** A casca diz a cada etapa qual passo ela é; o cartão mostra "Passo X de 4" e o ícone. */
export const ContextoPasso = createContext<PassoEtapa | null>(null);

export const usePasso = (): PassoEtapa | null => useContext(ContextoPasso);
