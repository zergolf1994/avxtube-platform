import { getAdminWorkers } from "@/lib/admin-api"

import { WorkersDashboard } from "./workers-dashboard"

export const dynamic = "force-dynamic"

export default async function WorkersPage() {
  return <WorkersDashboard initialData={await getAdminWorkers()} />
}
