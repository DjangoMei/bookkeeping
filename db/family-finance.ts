import { desc } from "drizzle-orm";
import { ensureFamilyFinanceSchema, getDb } from ".";
import { familyProjects, projectExpenses, savingsAccounts } from "./schema";

export async function readFamilyFinance() {
  await ensureFamilyFinanceSchema();
  const db = getDb();
  const [savings, projects, expenses] = await Promise.all([
    db.select().from(savingsAccounts).orderBy(desc(savingsAccounts.updatedAt), desc(savingsAccounts.id)),
    db.select().from(familyProjects).orderBy(desc(familyProjects.updatedAt), desc(familyProjects.id)),
    db.select().from(projectExpenses).orderBy(desc(projectExpenses.expenseDate), desc(projectExpenses.id)),
  ]);
  return {
    savings,
    projects,
    expenses,
    totals: {
      savingsCents: savings.reduce((sum, item) => sum + item.balanceCents, 0),
      projectSpentCents: expenses.reduce((sum, item) => sum + item.amountCents, 0),
    },
    serverSyncedAt: new Date().toISOString(),
  };
}
