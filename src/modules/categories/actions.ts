"use server";
// Every exported function in a "use server" file becomes a Server Action: the
// browser calls it like an endpoint, so inputs are untrusted and validated here.

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  type CategoryFieldErrors,
  type CategoryFormValues,
  categoryInputSchema,
} from "@/modules/categories/schemas";
import {
  CategoryInUseError,
  CategoryNameTakenError,
  CategoryNotFoundError,
  createCategory,
  deleteCategory,
  setCategoryArchived,
  updateCategory,
} from "@/modules/categories/service";

export type CategoryFormState = {
  errors?: CategoryFieldErrors;
  formError?: string;
  values?: CategoryFormValues;
};

const LIST = "/settings/categories";
const nameTaken: CategoryFieldErrors = { name: ["Já existe uma categoria com esse nome."] };

function readCategoryForm(formData: FormData): CategoryFormValues {
  const name = formData.get("name");
  return {
    name: typeof name === "string" ? name : "",
    allowsRoutine: formData.get("allowsRoutine") === null ? undefined : "on",
  };
}

/** Categories show up in the PDI action forms too. */
function revalidateCategoryScreens() {
  revalidatePath(LIST);
  revalidatePath("/pdi", "layout");
  revalidatePath("/");
}

export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const values = readCategoryForm(formData);
  const parsed = categoryInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await createCategory(parsed.data);
  } catch (error) {
    if (error instanceof CategoryNameTakenError) return { errors: nameTaken, values };
    throw error;
  }
  revalidateCategoryScreens();
  redirect(LIST);
}

export async function updateCategoryAction(
  id: string,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const values = readCategoryForm(formData);
  const parsed = categoryInputSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await updateCategory(id, parsed.data);
  } catch (error) {
    if (error instanceof CategoryNameTakenError) return { errors: nameTaken, values };
    if (error instanceof CategoryNotFoundError) {
      return { formError: "Esta categoria não existe mais.", values };
    }
    throw error;
  }
  revalidateCategoryScreens();
  redirect(LIST);
}

export async function setCategoryArchivedAction(id: string, archived: boolean): Promise<void> {
  try {
    await setCategoryArchived(id, z.boolean().parse(archived));
  } catch (error) {
    if (!(error instanceof CategoryNotFoundError)) throw error;
  }
  revalidateCategoryScreens();
  refresh();
}

export async function deleteCategoryAction(id: string): Promise<void> {
  try {
    await deleteCategory(id);
  } catch (error) {
    // The delete button only shows for unused categories; a stale page (an
    // action created in another tab) just gets refreshed with the new count.
    if (!(error instanceof CategoryNotFoundError || error instanceof CategoryInUseError)) {
      throw error;
    }
  }
  revalidateCategoryScreens();
  refresh();
}
