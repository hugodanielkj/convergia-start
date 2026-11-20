import type { EtapaId } from './passo';

/** Traços de 24×24, sem preenchimento: herdam a cor do texto. */
const TRACOS: Record<EtapaId, string[]> = {
  // Prancheta com linhas: perguntas sobre a empresa.
  formulario: [
    'M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1z',
    'M8 5H6.5A1.5 1.5 0 005 6.5v13A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0017.5 5H16',
    'M8.5 11h7M8.5 14.5h7M8.5 18h4',
  ],
  // Pessoa com "+": adicionar a agência como parceira.
  acessos: [
    'M10 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
    'M3.5 20a6.5 6.5 0 0113 0',
    'M19 8v6M16 11h6',
  ],
  // Câmera de vídeo: reunião online.
  reuniao: [
    'M4.5 7h10A1.5 1.5 0 0116 8.5v7a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 013 15.5v-7A1.5 1.5 0 014.5 7z',
    'M16 10.5l5-3v9l-5-3',
  ],
  // Câmera fotográfica: captação presencial.
  captacao: [
    'M4.5 8h3l1.5-2.5h6L16.5 8h3A1.5 1.5 0 0121 9.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5v-9A1.5 1.5 0 014.5 8z',
    'M12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  ],
};

/** Ícone decorativo de cada etapa; o nome da etapa sempre aparece em texto ao lado. */
export function IconePasso({ etapa }: { etapa: EtapaId }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRACOS[etapa].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
