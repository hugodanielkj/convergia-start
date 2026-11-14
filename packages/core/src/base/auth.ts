export type Papel = 'admin' | 'membro';

/** Usuário da equipe com sessão válida. Clientes nunca têm sessão (RN-01). */
export interface UsuarioAutenticado {
  id: string;
  agenciaId: string;
  nome: string;
  email: string;
  papel: Papel;
}

/** RN-03: somente o admin altera configurações da agência. */
export function podeAlterarConfiguracoes(usuario: Pick<UsuarioAutenticado, 'papel'>): boolean {
  return usuario.papel === 'admin';
}

/** RN-02: membro só vê onboardings dos quais é responsável; admin vê todos. */
export function podeVerOnboarding(
  usuario: Pick<UsuarioAutenticado, 'id' | 'papel'>,
  responsavelId: string,
): boolean {
  return usuario.papel === 'admin' || usuario.id === responsavelId;
}
