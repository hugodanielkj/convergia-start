import estilos from './clientes.module.css';

export interface Responsavel {
  id: string;
  nome: string;
  email: string;
}

/** Nome da pessoa; com o e-mail junto quando outra pessoa da equipe tem o mesmo nome. */
export function rotuloResponsavel(r: Responsavel, todos: readonly Responsavel[]): string {
  const repetido = todos.some((o) => o.id !== r.id && o.nome === r.nome);
  return repetido ? `${r.nome} · ${r.email}` : r.nome;
}

/** RN-08: o Admin escolhe quem cuida do cliente; começa marcado nele mesmo. */
export function SeletorResponsavel({
  responsaveis,
  euId,
}: {
  responsaveis: readonly Responsavel[];
  euId: string;
}) {
  return (
    <div className={estilos.campo}>
      <label htmlFor="responsavelId">Responsável</label>
      <select id="responsavelId" name="responsavelId" defaultValue={euId}>
        {responsaveis.map((r) => (
          <option key={r.id} value={r.id}>
            {rotuloResponsavel(r, responsaveis)}
            {r.id === euId ? ' (você)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
