// Initial data. Run with `npx prisma db seed`.
// Empty for now: the default action categories arrive in roadmap step 4,
// together with the ActionCategory model. Keep every write idempotent (upsert).

async function main(): Promise<void> {}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
