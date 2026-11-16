import Link from "next/link";

import { Button } from "@/components/ui/button";

const areas = [
  {
    text: "Objetivos reúnem o que você quer alcançar e mostram o progresso de tudo que se liga a eles.",
    href: "/goals/new",
    label: "Criar objetivo",
  },
  {
    text: "Trilhas organizam o estudo em etapas, com prazo e material.",
    href: "/tracks/new",
    label: "Criar trilha",
  },
  {
    text: "Rotinas são os hábitos do dia a dia, marcados na tela Hoje.",
    href: "/routines/new",
    label: "Criar rotina",
  },
  {
    text: "Ciclos de PDI guardam o plano de desenvolvimento combinado com o gestor.",
    href: "/pdi/new",
    label: "Criar ciclo de PDI",
  },
];

/** Shown instead of the cards while nothing has been created. */
export function Welcome() {
  return (
    <section aria-labelledby="titulo-boas-vindas" className="space-y-4">
      <h2 id="titulo-boas-vindas" className="text-lg font-semibold tracking-tight">
        Por onde começar
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {areas.map((area) => (
          <li key={area.href} className="bg-card space-y-3 rounded-lg border p-4">
            <p className="text-sm">{area.text}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={area.href}>{area.label}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
