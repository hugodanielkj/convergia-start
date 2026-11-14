import { redirect } from 'next/navigation';

/** A tela inicial do painel é a lista de onboardings (S3). */
export default function Inicio(): never {
  redirect('/onboardings');
}
