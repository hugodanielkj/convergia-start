import estilos from './componentes.module.css';

export function BarraProgresso({ concluidas, total }: { concluidas: number; total: number }) {
  return (
    <div className={estilos.progresso}>
      <progress
        className={estilos.barra}
        value={concluidas}
        max={total}
        aria-labelledby="rotulo-progresso"
      />
      <span id="rotulo-progresso">
        {concluidas} de {total} etapas concluídas
      </span>
    </div>
  );
}
