import { LogOut } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { logoutAction } from "@/modules/auth/actions";

/** A form, not a link: logging out changes data (deletes the session), so it is a POST. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <SubmitButton variant="ghost" size="sm" aria-label="Sair do Prumo">
        <LogOut aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Sair</span>
      </SubmitButton>
    </form>
  );
}
