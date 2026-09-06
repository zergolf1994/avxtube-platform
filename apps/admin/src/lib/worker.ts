import type { WorkerStatus, WorkerType } from "@workspace/core/enums"

export type AdminWorker = {
  _id: string
  workerId?: string
  hostname?: string
  ip?: string
  pid?: number | string
  version?: string
  storageId?: string
  enable: boolean
  type: WorkerType
  status: WorkerStatus
  activeJobs: number
  maxJobs: number
  system?: {
    diskTotal?: number
    diskUsed?: number
    diskFree?: number
    memTotal?: number
    memUsed?: number
    cpuPercent?: number
  }
  heartbeatAt?: string
  createdAt: string
  updatedAt: string
}

export type AdminWorkersResponse = {
  now: string
  workers: AdminWorker[]
}
