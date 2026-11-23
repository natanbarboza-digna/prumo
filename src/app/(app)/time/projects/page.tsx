import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { SubmitButton } from "@/components/submit-button";
import { NameForm } from "@/components/time/name-form";
import { Badge } from "@/components/ui/badge";
import { renameTimeProjectAction, setTimeProjectArchivedAction } from "@/modules/time/actions";
import { listTimeProjects } from "@/modules/time/service";

export const metadata: Metadata = { title: "Projetos e clientes" };

/** Projects and clients (plan 031): created from the blocks; renamed and archived here. */
export default async function TimeProjectsPage() {
  // No URL data is read here, so make the per-request rendering explicit.
  await connection();
  const projects = await listTimeProjects({ includeArchived: true });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/time" className="text-muted-foreground text-sm hover:underline">
          ← Tempo
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Projetos e clientes</h1>
        <p className="text-muted-foreground">
          Um projeto é criado ao digitar um nome novo num bloco. Arquivados não aceitam registros
          novos.
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhum projeto ainda. Digite o nome de um projeto ou cliente num bloco do{" "}
          <Link href="/time" className="underline underline-offset-4">
            dia
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-3" aria-label="Projetos e clientes">
          {projects.map((project) => (
            <li key={project.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium break-words">{project.name}</h2>
                {project.archived && <Badge variant="outline">Arquivado</Badge>}
              </div>
              <NameForm
                action={renameTimeProjectAction.bind(null, project.id)}
                kind="project"
                label={`Nome do projeto ${project.name}`}
                defaultName={project.name}
                submitLabel="Renomear"
              />
              <form action={setTimeProjectArchivedAction.bind(null, project.id, !project.archived)}>
                <SubmitButton size="sm" variant="outline">
                  {project.archived ? `Desarquivar ${project.name}` : `Arquivar ${project.name}`}
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
