'use client';

import estilos from './personalizar.module.css';
import { MENSAGEM_NENHUMA, type EstadoAcessos } from './tipos';

/** Botões de marcar das plataformas (RN-27). Login e senha nunca entram no sistema (D-05). */
export function EscolhaPlataformas({
  opcoes,
  escolhidas,
  aoMudar,
  nome,
}: {
  opcoes: EstadoAcessos['plataformas'];
  escolhidas: readonly string[];
  aoMudar: (escolhidas: string[]) => void;
  /** Nome do campo quando a escolha vai num formulário (cadastro). */
  nome?: string;
}) {
  function alternar(plataforma: string, marcada: boolean) {
    const conjunto = new Set(escolhidas);
    if (marcada) conjunto.add(plataforma);
    else conjunto.delete(plataforma);
    aoMudar(opcoes.map((o) => o.plataforma).filter((p) => conjunto.has(p)));
  }

  return (
    <>
      <div className={estilos.plataformas} role="group" aria-label="Plataformas pedidas">
        {opcoes.map((o) => (
          <label key={o.plataforma} className={estilos.plataforma}>
            <input
              type="checkbox"
              name={nome}
              value={o.plataforma}
              checked={escolhidas.includes(o.plataforma)}
              onChange={(e) => {
                alternar(o.plataforma, e.target.checked);
              }}
            />
            <span>{o.nome}</span>
          </label>
        ))}
      </div>
      {escolhidas.length === 0 && (
        <p role="alert" className={estilos.alerta}>
          {MENSAGEM_NENHUMA}
        </p>
      )}
      <p className={estilos.dica}>
        Acesso por parceiro: o cliente adiciona a agência. Senhas ficam fora do sistema.
      </p>
    </>
  );
}
