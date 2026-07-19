import type { UpstreamService } from './config.js'

export type MonitorStatus = 'up' | 'degraded' | 'down'
export type CapabilityStatus = 'available' | 'unconfigured' | 'unavailable' | 'issue'

interface MonitorDefinition {
  id: string
  name: string
  service: string
  path: string
  publicPath: string
  kind: 'health' | 'inventory' | 'api'
  critical: boolean
  inventory?: 'engines' | 'providers' | 'tools'
}

interface InternalCheckResult {
  id: string
  name: string
  service: string
  path: string
  kind: MonitorDefinition['kind']
  critical: boolean
  status: MonitorStatus
  statusCode: number | null
  latencyMs: number
  checkedAt: string
  error?: string
  body?: unknown
}

export interface CheckResult extends Omit<InternalCheckResult, 'body'> {}

export interface HistorySample {
  checkedAt: string
  status: MonitorStatus
  latencyMs: number
}

export interface Capability {
  id: string
  name: string
  service: string
  category: 'AI Provider' | 'AI Model' | 'Datenschutz' | 'Guardrails' | 'Moderation' | 'Red Teaming'
  status: CapabilityStatus
  sourceStatus: string
  detail: string
  parentId?: string
}

export interface ServiceMonitor {
  id: string
  name: string
  status: MonitorStatus
  latencyMs: number
  endpointsUp: number
  endpointsTotal: number
  capabilityIssues: number
  uptimePercent: number
}

export interface MonitoringSnapshot {
  status: MonitorStatus
  checkedAt: string
  durationMs: number
  checks: CheckResult[]
  services: ServiceMonitor[]
  capabilities: Capability[]
  history: Record<string, HistorySample[]>
  summary: {
    servicesUp: number
    servicesTotal: number
    endpointsUp: number
    endpointsTotal: number
    capabilitiesAvailable: number
    capabilitiesTotal: number
    averageLatencyMs: number
    uptimePercent: number
    activeIssues: number
  }
}

const HISTORY_LIMIT = 60
const FRESH_FOR_MS = 12_000
const PROBE_TIMEOUT_MS = 10_000
const history = new Map<string, HistorySample[]>()
let latest: MonitoringSnapshot | null = null
let activeRun: Promise<MonitoringSnapshot> | null = null

const serviceLabels: Record<string, string> = {
  'pii-service': 'PII & Datenschutz',
  'guardrails-service': 'Guardrails',
  'moderation-service': 'Content-Moderation',
  'redteam-service': 'Red Teaming',
  orchestrator: 'AI Orchestrator'
}

function definitions(services: UpstreamService[]): Array<MonitorDefinition & { url: string }> {
  const byName = new Map(services.map((service) => [service.name, service]))
  const monitors: MonitorDefinition[] = [
    { id: 'pii-health', name: 'Health Check', service: 'pii-service', path: '/health', publicPath: '/api/pii/health', kind: 'health', critical: true },
    { id: 'pii-engines', name: 'PII Engines', service: 'pii-service', path: '/v1/engines', publicPath: '/api/pii/v1/engines', kind: 'inventory', critical: false, inventory: 'engines' },
    { id: 'guardrails-health', name: 'Health Check', service: 'guardrails-service', path: '/health', publicPath: '/api/guardrails/health', kind: 'health', critical: true },
    { id: 'guardrails-engines', name: 'Guardrail Engines', service: 'guardrails-service', path: '/v1/engines', publicPath: '/api/guardrails/v1/engines', kind: 'inventory', critical: false, inventory: 'engines' },
    { id: 'moderation-health', name: 'Health Check', service: 'moderation-service', path: '/health', publicPath: '/api/moderation/health', kind: 'health', critical: true },
    { id: 'moderation-engines', name: 'Moderation Engines', service: 'moderation-service', path: '/v1/engines', publicPath: '/api/moderation/v1/engines', kind: 'inventory', critical: false, inventory: 'engines' },
    { id: 'redteam-health', name: 'Health Check', service: 'redteam-service', path: '/health', publicPath: '/api/redteam/health', kind: 'health', critical: true },
    { id: 'redteam-tools', name: 'Red-Team-Tools', service: 'redteam-service', path: '/v1/tools', publicPath: '/api/redteam/v1/tools', kind: 'inventory', critical: false, inventory: 'tools' },
    { id: 'redteam-scans', name: 'Scan Jobs API', service: 'redteam-service', path: '/v1/scans', publicPath: '/api/redteam/v1/scans', kind: 'api', critical: false },
    { id: 'orchestrator-health', name: 'Health Check', service: 'orchestrator', path: '/health', publicPath: '/api/orchestrator/health', kind: 'health', critical: true },
    { id: 'orchestrator-providers', name: 'AI Provider & Modelle', service: 'orchestrator', path: '/v1/providers', publicPath: '/api/orchestrator/v1/providers', kind: 'inventory', critical: false, inventory: 'providers' },
    { id: 'orchestrator-policies', name: 'Policy API', service: 'orchestrator', path: '/v1/policies', publicPath: '/api/orchestrator/v1/policies', kind: 'api', critical: false }
  ]

  return monitors.flatMap((monitor) => {
    const service = byName.get(monitor.service)
    return service ? [{ ...monitor, url: `${service.url}${monitor.path}` }] : []
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function statusFor(sourceStatus: string): CapabilityStatus {
  if (sourceStatus === 'ready' || sourceStatus === 'ok') return 'available'
  if (sourceStatus === 'not_configured') return 'unconfigured'
  if (sourceStatus === 'not_installed') return 'unavailable'
  return 'issue'
}

function engineCategory(service: string): Capability['category'] {
  if (service === 'pii-service') return 'Datenschutz'
  if (service === 'guardrails-service') return 'Guardrails'
  return 'Moderation'
}

function capabilitiesFrom(checks: InternalCheckResult[], definitionsById: Map<string, MonitorDefinition>): Capability[] {
  const capabilities: Capability[] = []

  for (const check of checks) {
    const definition = definitionsById.get(check.id)
    if (!definition?.inventory || !isRecord(check.body)) continue

    if (definition.inventory === 'providers') {
      const providers = Array.isArray(check.body.providers) ? check.body.providers : []
      for (const rawProvider of providers) {
        if (!isRecord(rawProvider)) continue
        const id = textValue(rawProvider.name, 'unknown-provider')
        const sourceStatus = textValue(rawProvider.status, 'unknown')
        capabilities.push({
          id: `provider-${id}`,
          name: textValue(rawProvider.title, id),
          service: check.service,
          category: 'AI Provider',
          status: statusFor(sourceStatus),
          sourceStatus,
          detail: textValue(rawProvider.detail, 'Kein Statusdetail verfügbar.')
        })

        const models = Array.isArray(rawProvider.models) ? rawProvider.models : []
        for (const rawModel of models) {
          if (typeof rawModel !== 'string') continue
          capabilities.push({
            id: `model-${id}-${rawModel}`,
            name: rawModel,
            service: check.service,
            category: 'AI Model',
            status: statusFor(sourceStatus),
            sourceStatus,
            detail: `Verfügbar über ${textValue(rawProvider.title, id)}.`,
            parentId: `provider-${id}`
          })
        }
      }
      continue
    }

    const listKey = definition.inventory === 'tools' ? 'tools' : 'engines'
    const entries = Array.isArray(check.body[listKey]) ? check.body[listKey] : []
    for (const rawEntry of entries) {
      if (!isRecord(rawEntry)) continue
      const id = textValue(rawEntry.name, 'unknown-capability')
      const sourceStatus = textValue(rawEntry.status, 'unknown')
      capabilities.push({
        id: `${check.service}-${id}`,
        name: textValue(rawEntry.title, id),
        service: check.service,
        category: definition.inventory === 'tools' ? 'Red Teaming' : engineCategory(check.service),
        status: statusFor(sourceStatus),
        sourceStatus,
        detail: textValue(rawEntry.detail, 'Kein Statusdetail verfügbar.')
      })
    }
  }
  return capabilities
}

async function probe(monitor: MonitorDefinition & { url: string }): Promise<InternalCheckResult> {
  const startedAt = performance.now()
  const checkedAt = new Date().toISOString()
  try {
    const response = await fetch(monitor.url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt))
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = undefined
    }
    return {
      id: monitor.id,
      name: monitor.name,
      service: monitor.service,
      path: monitor.publicPath,
      kind: monitor.kind,
      critical: monitor.critical,
      status: response.ok ? 'up' : response.status >= 500 ? 'down' : 'degraded',
      statusCode: response.status,
      latencyMs,
      checkedAt,
      error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
      body
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Verbindungsfehler'
    return {
      id: monitor.id,
      name: monitor.name,
      service: monitor.service,
      path: monitor.publicPath,
      kind: monitor.kind,
      critical: monitor.critical,
      status: 'down',
      statusCode: null,
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      checkedAt,
      error: message.slice(0, 180)
    }
  }
}

function uptimeFor(samples: HistorySample[]): number {
  if (!samples.length) return 100
  return Math.round((samples.filter((sample) => sample.status === 'up').length / samples.length) * 10_000) / 100
}

async function run(services: UpstreamService[]): Promise<MonitoringSnapshot> {
  const startedAt = performance.now()
  const monitors = definitions(services)
  const checksWithBodies = await Promise.all(monitors.map(probe))

  for (const check of checksWithBodies) {
    const samples = history.get(check.id) ?? []
    samples.push({ checkedAt: check.checkedAt, status: check.status, latencyMs: check.latencyMs })
    history.set(check.id, samples.slice(-HISTORY_LIMIT))
  }

  const definitionMap = new Map(monitors.map((monitor) => [monitor.id, monitor]))
  const capabilities = capabilitiesFrom(checksWithBodies, definitionMap)
  const checks: CheckResult[] = checksWithBodies.map(({ body: _body, ...check }) => check)
  const serviceMonitors = services.map<ServiceMonitor>((service) => {
    const serviceChecks = checks.filter((check) => check.service === service.name)
    const healthCheck = serviceChecks.find((check) => check.kind === 'health')
    const endpointsUp = serviceChecks.filter((check) => check.status === 'up').length
    const capabilityIssues = capabilities.filter((capability) => capability.service === service.name && capability.status !== 'available').length
    const healthSamples = healthCheck ? history.get(healthCheck.id) ?? [] : []
    const status: MonitorStatus = healthCheck?.status === 'down'
      ? 'down'
      : serviceChecks.some((check) => check.status !== 'up')
        ? 'degraded'
        : 'up'
    return {
      id: service.name,
      name: serviceLabels[service.name] ?? service.name,
      status,
      latencyMs: healthCheck?.latencyMs ?? 0,
      endpointsUp,
      endpointsTotal: serviceChecks.length,
      capabilityIssues,
      uptimePercent: uptimeFor(healthSamples)
    }
  })

  const allSamples = [...history.values()].flat()
  const endpointsUp = checks.filter((check) => check.status === 'up').length
  const activeIssues = checks.filter((check) => check.status !== 'up').length
    + capabilities.filter((capability) => capability.status === 'issue').length
  const status: MonitorStatus = checks.some((check) => check.critical && check.status === 'down')
    ? 'down'
    : checks.some((check) => check.status !== 'up')
      ? 'degraded'
      : 'up'

  latest = {
    status,
    checkedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startedAt),
    checks,
    services: serviceMonitors,
    capabilities,
    history: Object.fromEntries(history),
    summary: {
      servicesUp: serviceMonitors.filter((service) => service.status === 'up').length,
      servicesTotal: serviceMonitors.length,
      endpointsUp,
      endpointsTotal: checks.length,
      capabilitiesAvailable: capabilities.filter((capability) => capability.status === 'available').length,
      capabilitiesTotal: capabilities.length,
      averageLatencyMs: checks.length ? Math.round(checks.reduce((sum, check) => sum + check.latencyMs, 0) / checks.length) : 0,
      uptimePercent: uptimeFor(allSamples),
      activeIssues
    }
  }
  return latest
}

export function getMonitoringSnapshot(services: UpstreamService[], force = false): Promise<MonitoringSnapshot> {
  const isFresh = latest && Date.now() - new Date(latest.checkedAt).getTime() < FRESH_FOR_MS
  if (!force && isFresh) return Promise.resolve(latest as MonitoringSnapshot)
  if (activeRun) return activeRun
  activeRun = run(services).finally(() => { activeRun = null })
  return activeRun
}

export function startMonitoring(services: UpstreamService[]) {
  void getMonitoringSnapshot(services, true)
  const timer = setInterval(() => { void getMonitoringSnapshot(services, true) }, 30_000)
  timer.unref()
}
