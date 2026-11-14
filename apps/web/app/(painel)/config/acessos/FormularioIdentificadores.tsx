'use client';

import { useState, type SyntheticEvent } from 'react';
import estilos from './acessos.module.css';

const CAMPOS = [
  { chave: 'instagram', rotulo: 'Instagram (e-mail ou ID do Business Manager)' },
  { chave: 'facebook', rotulo: 'Facebook (e-mail ou ID do Business Manager)' },
  { chave: 'tiktok', rotulo: 'TikTok (e-mail ou ID do Business Center)' },
  { chave: 'google', rotulo: 'Google (e-mail do gerente)' },
];

export function FormularioIdentificadores({ inicial }: { inicial: Record<string, string> }) {
  const [valores, setValores] = useState(inicial);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: SyntheticEvent) {
    e.preventDefault();
    setOcupado(true);
    const r = await fetch('/api/acessos/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identificadores: valores }),
    });
    setOcupado(false);
    setAviso(
      r.ok
        ? { ok: true, texto: 'Salvo. Os clientes já veem o novo identificador.' }
        : { ok: false, texto: 'Não foi possível salvar.' },
    );
  }

  return (
    <form onSubmit={(e) => void salvar(e)} className={estilos.form}>
      <h1>Acessos das redes</h1>
      <p>
        É o que o cliente deve adicionar como parceiro em cada rede (RN-22). Nunca use senhas aqui.
      </p>
      {CAMPOS.map((c) => (
        <label key={c.chave} className={estilos.campo}>
          {c.rotulo}
          <input
            value={valores[c.chave] ?? ''}
            maxLength={200}
            onChange={(e) => {
              setValores({ ...valores, [c.chave]: e.target.value });
              setAviso(null);
            }}
          />
        </label>
      ))}
      <button type="submit" disabled={ocupado} className={estilos.botao}>
        Salvar
      </button>
      {aviso ? <p className={aviso.ok ? estilos.ok : estilos.erro}>{aviso.texto}</p> : null}
    </form>
  );
}
