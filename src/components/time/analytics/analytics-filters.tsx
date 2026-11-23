import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ANALYTICS_PERIODS, type AnalyticsQuery } from "@/modules/time/period";

export const periodLabels: Record<(typeof ANALYTICS_PERIODS)[number], string> = {
  thisWeek: "Esta semana",
  lastWeek: "Semana passada",
  thisMonth: "Este mês",
  lastMonth: "Mês passado",
  last30: "Últimos 30 dias",
  custom: "Personalizado",
};

type AnalyticsFiltersProps = {
  query: AnalyticsQuery;
  categories: { id: string; name: string }[];
  projects: { id: string; name: string }[];
};

/**
 * One GET form (plan 032): period, custom dates, category and project go to the
 * URL together, so the filters always combine and work without JavaScript.
 * A Server Component; useId keeps the ids unique in Next's hidden page copies.
 */
export function AnalyticsFilters({ query, categories, projects }: AnalyticsFiltersProps) {
  const base = useId();
  const id = (name: string) => `${base}-${name}`;

  return (
    <form action="/time/analytics" method="get" className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={id("periodo")}>Período</Label>
          <NativeSelect
            id={id("periodo")}
            name="periodo"
            defaultValue={query.period}
            className="w-full"
          >
            {ANALYTICS_PERIODS.map((period) => (
              <NativeSelectOption key={period} value={period}>
                {periodLabels[period]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("categoria")}>Categoria</Label>
          <NativeSelect
            id={id("categoria")}
            name="categoria"
            defaultValue={query.categoryId ?? ""}
            className="w-full"
          >
            <NativeSelectOption value="">Todas</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("projeto")}>Projeto ou cliente</Label>
          <NativeSelect
            id={id("projeto")}
            name="projeto"
            defaultValue={query.projectId ?? ""}
            className="w-full"
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            <NativeSelectOption value="none">Sem projeto</NativeSelectOption>
            {projects.map((project) => (
              <NativeSelectOption key={project.id} value={project.id}>
                {project.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="text-muted-foreground mb-1 text-sm">
          Datas do período personalizado
        </legend>
        <div className="space-y-1">
          <Label htmlFor={id("de")}>De</Label>
          <Input
            id={id("de")}
            name="de"
            type="date"
            defaultValue={query.period === "custom" ? query.from : ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("ate")}>Até</Label>
          <Input
            id={id("ate")}
            name="ate"
            type="date"
            defaultValue={query.period === "custom" ? query.to : ""}
          />
        </div>
        <Button type="submit">Aplicar</Button>
      </fieldset>
    </form>
  );
}
