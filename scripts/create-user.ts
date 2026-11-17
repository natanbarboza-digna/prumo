// `npm run auth:create-user`: creates the single account (plan 014).
// `npm run auth:create-user -- --reset-password`: sets a new password for a
// forgotten one, unlocks the account and ends every session.
//
// Asks for the email and the password in the terminal; the password is not
// shown while typing. For automation only, PRUMO_EMAIL and PRUMO_PASSWORD can
// be given as environment variables instead.
import "dotenv/config";

import { createInterface } from "node:readline/promises";

import { db } from "../src/lib/db";
import { accountSchema } from "../src/modules/auth/schemas";
import {
  AccountExistsError,
  AccountNotFoundError,
  createUser,
  resetPassword,
} from "../src/modules/auth/service";

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

/** Reads a line without echoing it: each typed character is swallowed. */
function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) return ask(question);
  stdout.write(question);
  return new Promise((resolve, reject) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          finish();
          reject(new Error("Cancelado."));
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset-password");
  const email = process.env.PRUMO_EMAIL ?? (await ask("E-mail: "));
  let password = process.env.PRUMO_PASSWORD;
  if (password === undefined) {
    password = await askHidden("Senha (pelo menos 12 caracteres): ");
    const confirmation = await askHidden("Repita a senha: ");
    if (password !== confirmation) throw new Error("As senhas não conferem.");
  }

  const parsed = accountSchema.safeParse({ email, password });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  if (reset) {
    await resetPassword(parsed.data.email, parsed.data.password);
    console.log("Senha trocada. Todas as sessões foram encerradas.");
  } else {
    await createUser(parsed.data.email, parsed.data.password);
    console.log(`Conta criada para ${parsed.data.email.toLowerCase()}.`);
  }
}

main()
  .catch((error: unknown) => {
    if (error instanceof AccountExistsError) {
      console.error("Já existe uma conta. Para trocar a senha, use --reset-password.");
    } else if (error instanceof AccountNotFoundError) {
      console.error("Não existe conta com esse e-mail.");
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
