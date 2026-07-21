export type RiskLevel = 'low' | 'medium' | 'high'
export type ProcessStatus = 'active' | 'pilot' | 'planned'
export type ToolStatus = 'active' | 'pilot' | 'planned'
export type WorkflowNodeType = 'trigger' | 'task' | 'ai' | 'decision' | 'approval' | 'end'
export type LandscapeLayer = 'management' | 'core' | 'support'
export type ProcessRelationType = 'handoff' | 'governance' | 'support' | 'data'
export type ExecutionMode = 'manual' | 'rule_automated' | 'ai_assisted' | 'ai_autonomous'
export type AutomationPotential = 'none' | 'partial' | 'full'
export type DemoPreset = 'compact' | 'complex' | 'custom'
export type DataSensitivity = 'unclassified' | 'public' | 'internal' | 'confidential' | 'personal'
export type DataFlowDirection = 'inbound' | 'outbound' | 'internal'
export type DataFlowAiRole = 'ai_input' | 'retrieval_context' | 'ai_output' | 'tool_to_tool' | 'training_or_evaluation'
export type DataFlowControlStatus = 'covered' | 'review_required' | 'blocked'
export type DataFlowMonitoringStatus = 'not_connected' | 'expected' | 'observed' | 'deviation'

export interface ProcessRelation {
  id: string
  targetId: string
  type: ProcessRelationType
  label: string
}

export interface DataFlow {
  id: string
  label: string
  sourceProcessId: string
  targetProcessId?: string
  sourceStepId?: string
  sourceSystem: string
  targetSystem: string
  aiToolId?: string
  dataCategories: string[]
  sensitivity: DataSensitivity
  direction: DataFlowDirection
  aiRole: DataFlowAiRole
  isExternal: boolean
  owner: string
  controlStatus: DataFlowControlStatus
  controlNote: string
  linkedPolicyIds: string[]
  linkedGuardrailIds: string[]
  monitoringStatus: DataFlowMonitoringStatus
}

export interface WorkflowPosition {
  x: number
  y: number
}

export interface WorkflowConnection {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  label?: string
  condition: 'always' | 'yes' | 'no' | 'fallback'
}

export interface AiTool {
  id: string
  name: string
  vendor: string
  category: 'AI-Modell' | 'Datenschutz' | 'Safety' | 'Moderation' | 'Testing'
  status: ToolStatus
  risk: RiskLevel
  color: string
  initials: string
}

export interface ProcessStep {
  id: string
  title: string
  description: string
  owner: string
  department: string
  risk: RiskLevel
  toolIds: string[]
  humanApproval: boolean
  control: string
  workflowType: WorkflowNodeType
  bpmnElementType: string
  executionMode: ExecutionMode
  automationPotential: AutomationPotential
  position: WorkflowPosition
}

export type DataFlowGapType = 'ai_without_input' | 'external_uncontrolled' | 'personal_unprotected' | 'owner_missing' | 'handoff_unclassified'

export interface DataFlowGap {
  id: string
  type: DataFlowGapType
  priority: 'high' | 'medium'
  processId: string
  dataFlowId?: string
  title: string
  detail: string
}

export interface BpmnDocument {
  id: string
  xml: string
  processRefs: string[]
  updatedAt: string
}

export interface BusinessProcess {
  id: string
  name: string
  description: string
  owner: string
  status: ProcessStatus
  maturity: number
  volume: string
  landscapeLayer: LandscapeLayer
  domain: string
  relations: ProcessRelation[]
  steps: ProcessStep[]
  connections: WorkflowConnection[]
  bpmnDocumentId?: string
  bpmnProcessRef?: string
}

export interface ProcessMapMetrics {
  activities: number
  automatedActivities: number
  aiActivities: number
  manualActivities: number
  potentialActivities: number
  aiAutonomousActivities: number
  aiHumanApprovalActivities: number
  automationRate: number
  aiShare: number
  automationPotential: number
  aiAutonomy: number
  humanOversight: number
  governanceScore: number
}

type RawProcessStep = Omit<ProcessStep, 'workflowType' | 'position' | 'bpmnElementType' | 'executionMode' | 'automationPotential'> & {
  workflowType?: WorkflowNodeType
  position?: WorkflowPosition
  bpmnElementType?: string
  executionMode?: ExecutionMode
  automationPotential?: AutomationPotential
  // Read only while migrating the short-lived v4 step-based data-flow model.
  dataInput?: string
  dataOutput?: string
  dataClassification?: DataSensitivity
  dataBoundary?: 'unknown' | 'internal' | 'approved_external' | 'unapproved_external'
  guardrailAction?: 'not_defined' | 'log' | 'mask' | 'block'
}

type RawBusinessProcess = Omit<BusinessProcess, 'steps' | 'connections' | 'landscapeLayer' | 'domain' | 'relations'> & {
  landscapeLayer?: LandscapeLayer
  domain?: string
  relations?: ProcessRelation[]
  steps: RawProcessStep[]
  connections?: WorkflowConnection[]
}

type RawDataFlow = Partial<DataFlow> & Pick<DataFlow, 'id' | 'sourceProcessId'>

export const aiToolCatalog: AiTool[] = [
  { id: 'gpt-4o', name: 'GPT-4o', vendor: 'OpenAI', category: 'AI-Modell', status: 'active', risk: 'high', color: '#177b65', initials: 'OA' },
  { id: 'claude', name: 'Claude', vendor: 'Anthropic', category: 'AI-Modell', status: 'pilot', risk: 'high', color: '#c66b3d', initials: 'AN' },
  { id: 'llama', name: 'Llama 3.2', vendor: 'Ollama', category: 'AI-Modell', status: 'active', risk: 'medium', color: '#5b62c9', initials: 'LL' },
  { id: 'presidio', name: 'Presidio', vendor: 'Microsoft', category: 'Datenschutz', status: 'active', risk: 'low', color: '#2471d9', initials: 'PR' },
  { id: 'scrubadub', name: 'Scrubadub', vendor: 'Open Source', category: 'Datenschutz', status: 'active', risk: 'low', color: '#187f98', initials: 'SC' },
  { id: 'safair-guard', name: 'safAIr Guardrails', vendor: 'safAIr', category: 'Safety', status: 'active', risk: 'low', color: '#246bfd', initials: 'SG' },
  { id: 'llm-guard', name: 'LLM Guard', vendor: 'Protect AI', category: 'Safety', status: 'planned', risk: 'medium', color: '#6d55bf', initials: 'LG' },
  { id: 'llama-guard', name: 'Llama Guard 3', vendor: 'Meta', category: 'Moderation', status: 'pilot', risk: 'medium', color: '#ca4e6a', initials: 'MG' },
  { id: 'promptfoo', name: 'Promptfoo', vendor: 'Open Source', category: 'Testing', status: 'active', risk: 'low', color: '#b06c13', initials: 'PF' },
  { id: 'garak', name: 'Garak', vendor: 'NVIDIA', category: 'Testing', status: 'planned', risk: 'low', color: '#5d7d32', initials: 'GK' }
]

const defaultProcesses: RawBusinessProcess[] = [
  {
    id: 'customer-service',
    name: 'KI-gestützter Kundenservice',
    description: 'Vom Eingang einer Kundenanfrage bis zur qualitätsgesicherten Antwort.',
    owner: 'Leitung Customer Operations',
    status: 'active',
    maturity: 82,
    volume: '12.400 Vorgänge / Monat',
    landscapeLayer: 'core',
    domain: 'Customer Operations',
    relations: [],
    steps: [
      {
        id: 'cs-intake',
        title: 'Anfrage erfassen',
        description: 'Eingehende Anfragen aus E-Mail, Chat und Portal werden zentral aufgenommen.',
        owner: 'Service Desk',
        department: 'Customer Service',
        risk: 'low',
        toolIds: ['presidio'],
        humanApproval: false,
        control: 'PII wird vor der Weiterverarbeitung automatisch maskiert.'
      },
      {
        id: 'cs-classify',
        title: 'Anliegen klassifizieren',
        description: 'Thema, Dringlichkeit und zuständige Facheinheit werden automatisch erkannt.',
        owner: 'Service Automation',
        department: 'Operations',
        risk: 'medium',
        toolIds: ['llama', 'safair-guard'],
        humanApproval: false,
        control: 'Guardrails blockieren Prompt Injection und unerlaubte Inhalte.'
      },
      {
        id: 'cs-draft',
        title: 'Antwort entwerfen',
        description: 'Ein Sprachmodell erstellt auf Basis freigegebener Wissensquellen einen Antwortvorschlag.',
        owner: 'Customer Operations',
        department: 'Customer Service',
        risk: 'high',
        toolIds: ['gpt-4o', 'safair-guard'],
        humanApproval: true,
        control: 'Antworten werden auf Richtlinienverstöße und Halluzinationsrisiken geprüft.'
      },
      {
        id: 'cs-approve',
        title: 'Freigabe & Versand',
        description: 'Kritische Antworten werden fachlich geprüft, freigegeben und revisionssicher versendet.',
        owner: 'Teamleitung Service',
        department: 'Customer Service',
        risk: 'high',
        toolIds: ['llama-guard'],
        humanApproval: true,
        control: 'Vier-Augen-Freigabe bei Beschwerden und regulatorisch relevanten Aussagen.'
      },
      {
        id: 'cs-monitor',
        title: 'Qualität überwachen',
        description: 'Qualität, Sicherheitsvorfälle und Kundenzufriedenheit werden laufend ausgewertet.',
        owner: 'AI Governance',
        department: 'Risk & Compliance',
        risk: 'medium',
        toolIds: ['promptfoo'],
        humanApproval: false,
        control: 'Monatliche Stichproben und automatisierte Regressionstests.'
      }
    ]
  },
  {
    id: 'recruiting',
    name: 'Bewerbermanagement',
    description: 'Unterstützte Sichtung und Kommunikation im Recruiting – mit Human-in-the-Loop.',
    owner: 'Head of People & Culture',
    status: 'pilot',
    maturity: 61,
    volume: '850 Bewerbungen / Quartal',
    landscapeLayer: 'support',
    domain: 'People & Culture',
    relations: [
      { id: 'hr-to-cs-capacity', targetId: 'customer-service', type: 'support', label: 'Rollen, Skills und Kapazitäten' }
    ],
    steps: [
      {
        id: 'hr-receive',
        title: 'Bewerbung empfangen',
        description: 'Unterlagen werden erfasst und personenbezogene Daten klassifiziert.',
        owner: 'Talent Acquisition',
        department: 'People & Culture',
        risk: 'medium',
        toolIds: ['presidio'],
        humanApproval: false,
        control: 'Zugriff nur für berechtigte Recruiting-Rollen.'
      },
      {
        id: 'hr-screen',
        title: 'Unterlagen strukturieren',
        description: 'Qualifikationen werden extrahiert und für Recruiter strukturiert dargestellt.',
        owner: 'Talent Acquisition',
        department: 'People & Culture',
        risk: 'high',
        toolIds: ['claude', 'safair-guard'],
        humanApproval: true,
        control: 'Keine automatisierte Auswahlentscheidung; Bias-Prüfung im Pilotbetrieb.'
      },
      {
        id: 'hr-review',
        title: 'Fachliche Bewertung',
        description: 'Recruiting und Fachbereich bewerten die Unterlagen eigenständig.',
        owner: 'Hiring Manager',
        department: 'Fachbereich',
        risk: 'high',
        toolIds: [],
        humanApproval: true,
        control: 'Entscheidung und Begründung verbleiben vollständig beim Menschen.'
      },
      {
        id: 'hr-comms',
        title: 'Kommunikation',
        description: 'Individuelle Einladungen und Status-Updates werden vorbereitet.',
        owner: 'Recruiting Operations',
        department: 'People & Culture',
        risk: 'medium',
        toolIds: ['gpt-4o', 'safair-guard'],
        humanApproval: true,
        control: 'Versand ausschließlich nach manueller Prüfung.'
      }
    ]
  },
  {
    id: 'marketing-content',
    name: 'Marketing Content Creation',
    description: 'Ideation, Erstellung und Freigabe von markenkonformen Marketing-Inhalten.',
    owner: 'CMO / Brand Management',
    status: 'active',
    maturity: 74,
    volume: '320 Assets / Monat',
    landscapeLayer: 'core',
    domain: 'Marketing & Vertrieb',
    relations: [
      { id: 'marketing-to-cs-handoff', targetId: 'customer-service', type: 'handoff', label: 'Kampagnen erzeugen Kundenkontakte' }
    ],
    steps: [
      {
        id: 'mk-brief',
        title: 'Briefing erstellen',
        description: 'Ziele, Zielgruppe, Kanäle und rechtliche Rahmenbedingungen werden definiert.',
        owner: 'Campaign Lead',
        department: 'Marketing',
        risk: 'low',
        toolIds: [],
        humanApproval: true,
        control: 'Verbindliche Briefing-Vorlage mit Pflichtfeldern.'
      },
      {
        id: 'mk-create',
        title: 'Content generieren',
        description: 'Textvarianten werden auf Basis des freigegebenen Briefings erzeugt.',
        owner: 'Content Studio',
        department: 'Marketing',
        risk: 'medium',
        toolIds: ['gpt-4o', 'safair-guard'],
        humanApproval: false,
        control: 'Marken- und Inhaltsrichtlinien werden als Guardrails angewendet.'
      },
      {
        id: 'mk-review',
        title: 'Brand & Legal Review',
        description: 'Inhalte werden auf Markenfit, Claims, Urheberrecht und Compliance geprüft.',
        owner: 'Brand & Legal',
        department: 'Marketing / Legal',
        risk: 'high',
        toolIds: ['llama-guard'],
        humanApproval: true,
        control: 'Verbindliche Freigabe durch Brand oder Legal je nach Kampagnentyp.'
      },
      {
        id: 'mk-test',
        title: 'Qualität testen',
        description: 'Prompts und Outputs werden vor Rollout gegen bekannte Risiken getestet.',
        owner: 'AI Governance',
        department: 'Risk & Compliance',
        risk: 'medium',
        toolIds: ['promptfoo'],
        humanApproval: false,
        control: 'Regressionstest vor Änderungen an Modellen oder System-Prompts.'
      },
      {
        id: 'mk-publish',
        title: 'Veröffentlichen',
        description: 'Freigegebene Assets werden ausgespielt und ihre Performance überwacht.',
        owner: 'Channel Manager',
        department: 'Marketing',
        risk: 'medium',
        toolIds: [],
        humanApproval: true,
        control: 'Freigabeprotokoll und versionierte Ablage der finalen Assets.'
      }
    ]
  },
  {
    id: 'ai-governance',
    name: 'AI Governance & Risikosteuerung',
    description: 'Unternehmensweite Steuerung von KI-Risiken, Freigaben, Kontrollen und Wirksamkeitsnachweisen.',
    owner: 'Chief Risk & AI Governance Officer',
    status: 'active',
    maturity: 69,
    volume: 'Unternehmensweiter Steuerungsprozess',
    landscapeLayer: 'management',
    domain: 'Governance, Risk & Compliance',
    relations: [
      { id: 'gov-to-cs-controls', targetId: 'customer-service', type: 'governance', label: 'Risikokontrollen und Freigaberahmen' },
      { id: 'gov-to-marketing-controls', targetId: 'marketing-content', type: 'governance', label: 'Policy- und Kontrollvorgaben' },
      { id: 'gov-to-recruiting-controls', targetId: 'recruiting', type: 'governance', label: 'Bias-, Datenschutz- und Freigabekontrollen' }
    ],
    steps: [
      {
        id: 'gov-intake',
        title: 'AI Use Case registrieren',
        description: 'Neue KI-Anwendungen werden mit Zweck, Owner, Daten und betroffenen Prozessen erfasst.',
        owner: 'AI Governance Office',
        department: 'Risk & Compliance',
        risk: 'medium',
        toolIds: [],
        humanApproval: true,
        control: 'Verbindlicher Intake vor Pilot- oder Produktivbetrieb.'
      },
      {
        id: 'gov-assess',
        title: 'Risiko klassifizieren',
        description: 'Auswirkungen, Datenrisiken, Modellrisiken und regulatorische Anforderungen werden bewertet.',
        owner: 'AI Risk Management',
        department: 'Risk & Compliance',
        risk: 'high',
        toolIds: ['safair-guard'],
        humanApproval: true,
        control: 'Dokumentierte Risikoklasse und verbindlicher Kontrollkatalog.'
      },
      {
        id: 'gov-approve',
        title: 'Go-Live freigeben',
        description: 'Kontrollnachweise werden geprüft und der Einsatz freigegeben oder zurückgewiesen.',
        owner: 'AI Governance Board',
        department: 'Management',
        risk: 'high',
        toolIds: [],
        humanApproval: true,
        control: 'Formelle Freigabe mit dokumentierten Auflagen.'
      },
      {
        id: 'gov-monitor',
        title: 'Portfolio überwachen',
        description: 'Risiken, Vorfälle, Kontrollen und Modelländerungen werden über alle Prozesse verfolgt.',
        owner: 'AI Governance Office',
        department: 'Risk & Compliance',
        risk: 'medium',
        toolIds: ['promptfoo', 'garak'],
        humanApproval: false,
        control: 'Quartalsweises Management-Reporting und anlassbezogene Neubewertung.'
      }
    ]
  }
]

const defaultDataFlows: DataFlow[] = [
  {
    id: 'flow-cs-crm-input',
    label: 'Kundenanfrage für Klassifizierung',
    sourceProcessId: 'customer-service',
    sourceStepId: 'cs-classify',
    sourceSystem: 'CRM / Service-Postfach',
    targetSystem: 'Interner Llama-Service',
    aiToolId: 'llama',
    dataCategories: ['Kundennachricht', 'Kontaktinformationen'],
    sensitivity: 'personal',
    direction: 'inbound',
    aiRole: 'ai_input',
    isExternal: false,
    owner: 'Customer Operations',
    controlStatus: 'covered',
    controlNote: 'PII-Redaktion vor der Klassifizierung aktiv.',
    linkedPolicyIds: ['nur-pii'],
    linkedGuardrailIds: ['presidio', 'safair-guard'],
    monitoringStatus: 'expected'
  },
  {
    id: 'flow-cs-llm-draft',
    label: 'Antwortentwurf über externes LLM',
    sourceProcessId: 'customer-service',
    sourceStepId: 'cs-draft',
    sourceSystem: 'Service Console',
    targetSystem: 'OpenAI API',
    aiToolId: 'gpt-4o',
    dataCategories: ['Maskierte Kundennachricht', 'Freigegebene Wissensartikel'],
    sensitivity: 'personal',
    direction: 'outbound',
    aiRole: 'ai_input',
    isExternal: true,
    owner: 'Customer Operations',
    controlStatus: 'review_required',
    controlNote: 'PII-Redaktion aktiv; Wirksamkeit des Human Reviews noch bestätigen.',
    linkedPolicyIds: ['strikt'],
    linkedGuardrailIds: ['presidio', 'safair-guard'],
    monitoringStatus: 'expected'
  },
  {
    id: 'flow-marketing-generation',
    label: 'Kampagnenbriefing an freigegebenes AI-Tool',
    sourceProcessId: 'marketing-content',
    sourceStepId: 'mk-create',
    sourceSystem: 'Campaign Workspace',
    targetSystem: 'OpenAI API',
    aiToolId: 'gpt-4o',
    dataCategories: ['Kampagnenbriefing', 'Markenrichtlinien'],
    sensitivity: 'internal',
    direction: 'outbound',
    aiRole: 'ai_input',
    isExternal: true,
    owner: 'Content Studio',
    controlStatus: 'covered',
    controlNote: 'Tool-Allowlist und verpflichtende Output-Freigabe aktiv.',
    linkedPolicyIds: ['standard'],
    linkedGuardrailIds: ['safair-guard', 'llama-guard'],
    monitoringStatus: 'expected'
  },
  {
    id: 'flow-recruiting-screening',
    label: 'Bewerberprofil für AI-Screening',
    sourceProcessId: 'recruiting',
    sourceStepId: 'hr-screen',
    sourceSystem: 'Applicant Tracking System',
    targetSystem: 'Anthropic API',
    aiToolId: 'claude',
    dataCategories: ['Bewerberprofil', 'Lebenslauf'],
    sensitivity: 'personal',
    direction: 'outbound',
    aiRole: 'ai_input',
    isExternal: true,
    owner: 'Talent Acquisition',
    controlStatus: 'review_required',
    controlNote: 'Keine automatische Auswahlentscheidung; PII-Schutz muss noch verknüpft werden.',
    linkedPolicyIds: ['strikt'],
    linkedGuardrailIds: ['safair-guard'],
    monitoringStatus: 'not_connected'
  },
  {
    id: 'flow-cs-governance-reporting',
    label: 'Qualitäts- und Vorfalldaten',
    sourceProcessId: 'customer-service',
    targetProcessId: 'ai-governance',
    sourceStepId: 'cs-monitor',
    sourceSystem: 'Service Monitoring',
    targetSystem: 'Governance Workspace',
    dataCategories: ['Qualitätsmetriken', 'Sicherheitsvorfälle'],
    sensitivity: 'internal',
    direction: 'internal',
    aiRole: 'training_or_evaluation',
    isExternal: false,
    owner: 'AI Governance',
    controlStatus: 'covered',
    controlNote: 'Nur aggregierte Qualitäts- und Vorfalldaten werden übertragen.',
    linkedPolicyIds: ['standard'],
    linkedGuardrailIds: ['promptfoo'],
    monitoringStatus: 'expected'
  }
]

const defaultRelations = new Map(defaultProcesses.map((process) => [process.id, process.relations ?? []]))
const modelToolIds = new Set(['gpt-4o', 'claude', 'llama'])
const automatedBpmnTypes = new Set(['bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:BusinessRuleTask'])
const activityBpmnTypes = new Set([
  'bpmn:Task', 'bpmn:UserTask', 'bpmn:ManualTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask', 'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:SubProcess', 'bpmn:CallActivity'
])

function inferWorkflowType(step: RawProcessStep, index: number, length: number): WorkflowNodeType {
  if (step.workflowType) return step.workflowType
  if (step.id === 'cs-approve') return 'decision'
  if (index === 0) return 'trigger'
  if (index === length - 1) return 'end'
  if (step.risk === 'high' && step.humanApproval) return 'approval'
  if (step.toolIds.some((id) => modelToolIds.has(id))) return 'ai'
  return 'task'
}

function inferBpmnElementType(step: RawProcessStep, workflowType: WorkflowNodeType): string {
  if (step.bpmnElementType) return step.bpmnElementType.startsWith('bpmn:')
    ? step.bpmnElementType
    : `bpmn:${step.bpmnElementType.charAt(0).toUpperCase()}${step.bpmnElementType.slice(1)}`
  if (workflowType === 'trigger') return 'bpmn:StartEvent'
  if (workflowType === 'end') return 'bpmn:EndEvent'
  if (workflowType === 'decision') return 'bpmn:ExclusiveGateway'
  if (workflowType === 'approval') return 'bpmn:UserTask'
  if (workflowType === 'ai') return 'bpmn:ServiceTask'
  return 'bpmn:Task'
}

function inferExecutionMode(step: RawProcessStep, bpmnElementType: string): ExecutionMode {
  if (step.executionMode === 'ai_autonomous') return step.executionMode
  if (step.toolIds.some((id) => modelToolIds.has(id))) return 'ai_assisted'
  if (step.executionMode) return step.executionMode
  if (automatedBpmnTypes.has(bpmnElementType)) return 'rule_automated'
  return 'manual'
}

export function synchronizeExecutionModeForModelTool(step: ProcessStep, changedToolId: string) {
  if (!modelToolIds.has(changedToolId)) return
  const hasAssignedModel = step.toolIds.some((id) => modelToolIds.has(id))
  if (hasAssignedModel) {
    if (step.executionMode !== 'ai_assisted' && step.executionMode !== 'ai_autonomous') step.executionMode = 'ai_assisted'
    return
  }
  if (step.executionMode === 'ai_assisted' || step.executionMode === 'ai_autonomous') {
    step.executionMode = automatedBpmnTypes.has(step.bpmnElementType) ? 'rule_automated' : 'manual'
  }
}

function inferAutomationPotential(step: RawProcessStep, executionMode: ExecutionMode): AutomationPotential {
  if (step.automationPotential) return step.automationPotential
  return executionMode === 'manual' ? 'partial' : 'full'
}

function buildDefaultConnections(processId: string, steps: ProcessStep[]): WorkflowConnection[] {
  const linear: WorkflowConnection[] = []
  steps.slice(0, -1).forEach((step, index) => {
    const next = steps[index + 1]
    if (!next) return
    linear.push({
      id: `${processId}-edge-${step.id}-${next.id}`,
      source: step.id,
      target: next.id,
      condition: 'always'
    })
  })

  if (processId !== 'customer-service') return linear

  const decisionIndex = steps.findIndex((step) => step.id === 'cs-approve')
  if (decisionIndex < 1 || decisionIndex >= steps.length - 1) return linear

  const beforeDecision = steps[decisionIndex - 1]
  const decision = steps[decisionIndex]
  const afterDecision = steps[decisionIndex + 1]
  if (!beforeDecision || !decision || !afterDecision) return linear
  return [
    ...linear.filter((edge) => edge.source !== decision.id),
    {
      id: `${processId}-edge-${decision.id}-yes`,
      source: decision.id,
      target: afterDecision.id,
      sourceHandle: 'yes',
      label: 'Freigeben',
      condition: 'yes'
    },
    {
      id: `${processId}-edge-${decision.id}-no`,
      source: decision.id,
      target: beforeDecision.id,
      sourceHandle: 'no',
      label: 'Überarbeiten',
      condition: 'no'
    }
  ]
}

function normalizeProcesses(input: RawBusinessProcess[]): BusinessProcess[] {
  return input.map((rawProcess) => {
    const steps: ProcessStep[] = rawProcess.steps.map((rawStep, index) => {
      const { dataInput: _dataInput, dataOutput: _dataOutput, dataClassification: _dataClassification, dataBoundary: _dataBoundary, guardrailAction: _guardrailAction, ...baseStep } = rawStep
      const workflowType = inferWorkflowType(rawStep, index, rawProcess.steps.length)
      const bpmnElementType = inferBpmnElementType(rawStep, workflowType)
      const executionMode = inferExecutionMode(rawStep, bpmnElementType)
      return {
        ...baseStep,
        workflowType,
        bpmnElementType,
        executionMode,
        automationPotential: inferAutomationPotential(rawStep, executionMode),
        position: rawStep.position ?? { x: 70 + index * 270, y: 150 }
      }
    })
    const stepIds = new Set(steps.map((step) => step.id))
    const storedConnections = (rawProcess.connections ?? []).filter((edge) => stepIds.has(edge.source) && stepIds.has(edge.target))

    return {
      ...rawProcess,
      landscapeLayer: rawProcess.landscapeLayer ?? 'core',
      domain: rawProcess.domain ?? 'Geschäftsprozesse',
      relations: (rawProcess.relations ?? defaultRelations.get(rawProcess.id) ?? []).filter((relation) => relation.type !== 'data').map((relation, index) => ({
        ...relation,
        id: relation.id || `${rawProcess.id}-relation-${index + 1}`
      })),
      steps,
      connections: storedConnections.length
        ? storedConnections.map((edge) => ({ ...edge, condition: edge.condition ?? 'always' }))
        : buildDefaultConnections(rawProcess.id, steps)
    }
  })
}

const complexCatalog: Array<{ layer: LandscapeLayer; names: string[]; domains: string[] }> = [
  {
    layer: 'management',
    names: ['Strategie & Zielsystem', 'Unternehmenssteuerung', 'Governance & Risikomanagement'],
    domains: ['Strategie', 'Finanzen', 'Governance']
  },
  {
    layer: 'core',
    names: ['Markt verstehen', 'Produkte entwickeln', 'Angebote erstellen', 'Vertrieb steuern', 'Aufträge abwickeln', 'Leistung erbringen', 'Kunden betreuen', 'Qualität sichern', 'Service liefern', 'Kunden binden'],
    domains: ['Markt & Portfolio', 'Produkt', 'Vertrieb', 'Vertrieb', 'Operations', 'Operations', 'Customer Experience', 'Qualität', 'Service', 'Customer Experience']
  },
  {
    layer: 'support',
    names: ['Personal planen', 'Talente gewinnen', 'Mitarbeitende entwickeln', 'Finanzen planen', 'Abschlüsse erstellen', 'Einkauf steuern', 'Lieferanten managen', 'IT-Services betreiben', 'Informationssicherheit', 'Datenplattform betreiben', 'Recht beraten', 'Compliance überwachen', 'Gebäude betreiben', 'Kommunikation steuern', 'Wissen managen', 'Innovation fördern', 'Projektportfolio steuern', 'Nachhaltigkeit berichten', 'Datenschutz sicherstellen', 'Business Continuity'],
    domains: ['People', 'People', 'People', 'Finance', 'Finance', 'Procurement', 'Procurement', 'IT', 'IT', 'Data', 'Legal', 'Compliance', 'Facilities', 'Communications', 'Knowledge', 'Innovation', 'PMO', 'ESG', 'Privacy', 'Resilience']
  }
]

function complexDemoProcesses(): RawBusinessProcess[] {
  const flat = complexCatalog.flatMap((group) => group.names.map((name, index) => ({
    name,
    domain: group.domains[index] ?? group.domains[0] ?? 'Unternehmen',
    layer: group.layer
  })))
  return flat.map((entry, processIndex) => {
    const id = `demo-${entry.layer}-${processIndex + 1}`
    const executionModes: ExecutionMode[] = ['manual', 'rule_automated', 'ai_assisted', 'ai_autonomous']
    const mode = executionModes[processIndex % executionModes.length] ?? 'manual'
    const target = flat[(processIndex + 1) % flat.length]
    const targetId = `demo-${target?.layer ?? 'core'}-${((processIndex + 1) % flat.length) + 1}`
    return {
      id,
      name: entry.name,
      description: `Realistischer Demo-Prozess für ${entry.domain} mit getrennten Automatisierungs- und KI-Kennzahlen.`,
      owner: `Leitung ${entry.domain}`,
      status: processIndex % 7 === 0 ? 'pilot' : processIndex % 11 === 0 ? 'planned' : 'active',
      maturity: 45 + ((processIndex * 7) % 51),
      volume: `${350 + processIndex * 125} Vorgänge / Monat`,
      landscapeLayer: entry.layer,
      domain: entry.domain,
      relations: target ? [{
        id: `${id}-relation`,
        targetId,
        type: entry.layer === 'management' ? 'governance' : entry.layer === 'support' ? 'support' : 'handoff',
        label: entry.layer === 'management' ? 'Steuerungsvorgabe' : 'Definierte Übergabe'
      }] : [],
      steps: [
        {
          id: `${id}-start`, title: 'Bedarf eingegangen', description: 'Der Prozess wird durch einen dokumentierten Bedarf ausgelöst.', owner: `Team ${entry.domain}`, department: entry.domain,
          risk: 'low', toolIds: [], humanApproval: false, control: 'Vollständigkeit beim Eingang prüfen.', workflowType: 'trigger', bpmnElementType: 'bpmn:StartEvent', executionMode: 'manual', automationPotential: 'none'
        },
        {
          id: `${id}-prepare`, title: 'Vorgang vorbereiten', description: 'Daten und fachliche Voraussetzungen werden geprüft und aufbereitet.', owner: `Team ${entry.domain}`, department: entry.domain,
          risk: processIndex % 3 === 0 ? 'high' : 'medium', toolIds: mode.startsWith('ai_') ? ['safair-guard'] : [], humanApproval: mode === 'ai_autonomous', control: 'Plausibilitäts- und Berechtigungsprüfung.', workflowType: mode.startsWith('ai_') ? 'ai' : 'task', bpmnElementType: mode === 'rule_automated' ? 'bpmn:BusinessRuleTask' : mode.startsWith('ai_') ? 'bpmn:ServiceTask' : 'bpmn:Task', executionMode: mode, automationPotential: mode === 'manual' ? (processIndex % 2 ? 'partial' : 'full') : 'full'
        },
        {
          id: `${id}-decide`, title: 'Ergebnis prüfen', description: 'Ergebnis, Risiken und erforderliche Freigaben werden bewertet.', owner: `Process Owner ${entry.domain}`, department: entry.domain,
          risk: 'high', toolIds: mode.startsWith('ai_') ? ['gpt-4o'] : [], humanApproval: true, control: 'Vier-Augen-Prüfung bei wesentlichen Entscheidungen.', workflowType: 'approval', bpmnElementType: 'bpmn:UserTask', executionMode: mode === 'ai_autonomous' ? 'ai_assisted' : 'manual', automationPotential: 'partial'
        },
        {
          id: `${id}-end`, title: 'Ergebnis übergeben', description: 'Das freigegebene Ergebnis wird nachvollziehbar übergeben.', owner: `Team ${entry.domain}`, department: entry.domain,
          risk: 'low', toolIds: [], humanApproval: false, control: 'Übergabe und Abschluss protokollieren.', workflowType: 'end', bpmnElementType: 'bpmn:EndEvent', executionMode: 'manual', automationPotential: 'none'
        }
      ]
    }
  })
}

const cloneDefaults = () => normalizeProcesses(JSON.parse(JSON.stringify(defaultProcesses)) as RawBusinessProcess[])
const cloneComplexDemo = () => normalizeProcesses(complexDemoProcesses())
const cloneDefaultDataFlows = () => JSON.parse(JSON.stringify(defaultDataFlows)) as DataFlow[]

function complexDemoDataFlows(processes: BusinessProcess[]): DataFlow[] {
  return processes.flatMap((process, index) => {
    const step = process.steps.find(isAiDataFlowStep)
    if (!step) return []
    const external = index % 3 === 0
    return [{
      id: `flow-${process.id}`,
      label: `${process.name}: KI-Datenstrom`,
      sourceProcessId: process.id,
      sourceStepId: step.id,
      sourceSystem: `${process.domain} Fachsystem`,
      targetSystem: external ? 'Freigegebener AI-Anbieter' : 'Interne AI-Plattform',
      aiToolId: step.toolIds.find((id) => modelToolIds.has(id)) || 'gpt-4o',
      dataCategories: ['Vorgangsdaten', 'Fachlicher Kontext'],
      sensitivity: index % 5 === 0 ? 'personal' : 'internal',
      direction: external ? 'outbound' : 'internal',
      aiRole: 'ai_input',
      isExternal: external,
      owner: process.owner,
      controlStatus: index % 7 === 0 ? 'review_required' : 'covered',
      controlNote: index % 7 === 0 ? 'Kontrollwirksamkeit im Demo-Szenario prüfen.' : 'Freigegebener Demo-Datenstrom.',
      linkedPolicyIds: ['standard'],
      linkedGuardrailIds: index % 5 === 0 ? ['presidio', 'safair-guard'] : ['safair-guard'],
      monitoringStatus: 'not_connected'
    } satisfies DataFlow]
  })
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))] : []
}

function normalizeDataFlows(input: RawDataFlow[], processes: BusinessProcess[]): DataFlow[] {
  const processIds = new Set(processes.map((process) => process.id))
  return input.flatMap((raw, index) => {
    if (!raw?.sourceProcessId || !processIds.has(raw.sourceProcessId)) return []
    const source = processes.find((process) => process.id === raw.sourceProcessId)
    const sensitivity = ['public', 'internal', 'confidential', 'personal'].includes(String(raw.sensitivity)) ? raw.sensitivity as DataSensitivity : 'unclassified'
    const direction = ['inbound', 'outbound', 'internal'].includes(String(raw.direction)) ? raw.direction as DataFlowDirection : 'internal'
    const aiRole = ['ai_input', 'retrieval_context', 'ai_output', 'tool_to_tool', 'training_or_evaluation'].includes(String(raw.aiRole)) ? raw.aiRole as DataFlowAiRole : 'ai_input'
    const controlStatus = ['covered', 'review_required', 'blocked'].includes(String(raw.controlStatus)) ? raw.controlStatus as DataFlowControlStatus : 'review_required'
    const monitoringStatus = ['not_connected', 'expected', 'observed', 'deviation'].includes(String(raw.monitoringStatus)) ? raw.monitoringStatus as DataFlowMonitoringStatus : 'not_connected'
    const targetProcessId = raw.targetProcessId && processIds.has(raw.targetProcessId) ? raw.targetProcessId : undefined
    const sourceStepId = raw.sourceStepId && source?.steps.some((step) => step.id === raw.sourceStepId) ? raw.sourceStepId : undefined
    return [{
      id: raw.id || `data-flow-${index + 1}`,
      label: raw.label?.trim() || 'Datenfluss',
      sourceProcessId: raw.sourceProcessId,
      targetProcessId,
      sourceStepId,
      sourceSystem: raw.sourceSystem?.trim() || '',
      targetSystem: raw.targetSystem?.trim() || '',
      aiToolId: raw.aiToolId?.trim() || undefined,
      dataCategories: normalizeStringList(raw.dataCategories),
      sensitivity,
      direction,
      aiRole,
      isExternal: Boolean(raw.isExternal),
      owner: raw.owner?.trim() || '',
      controlStatus,
      controlNote: raw.controlNote?.trim() || '',
      linkedPolicyIds: normalizeStringList(raw.linkedPolicyIds),
      linkedGuardrailIds: normalizeStringList(raw.linkedGuardrailIds),
      monitoringStatus
    }]
  })
}

function migrateLegacyDataFlows(rawProcesses: RawBusinessProcess[], processes: BusinessProcess[]): DataFlow[] {
  const migrated: RawDataFlow[] = []
  for (const rawProcess of rawProcesses) {
    const process = processes.find((item) => item.id === rawProcess.id)
    if (!process) continue
    for (const rawStep of rawProcess.steps) {
      if (![rawStep.dataInput, rawStep.dataOutput, rawStep.dataClassification, rawStep.dataBoundary, rawStep.guardrailAction].some(Boolean)) continue
      const step = process.steps.find((item) => item.id === rawStep.id)
      const external = rawStep.dataBoundary === 'approved_external' || rawStep.dataBoundary === 'unapproved_external'
      migrated.push({
        id: `flow-migrated-${rawStep.id}`,
        label: `${step?.title || rawStep.title}: migrierter Datenstrom`,
        sourceProcessId: process.id,
        sourceStepId: rawStep.id,
        sourceSystem: rawStep.dataInput || '',
        targetSystem: external ? 'Externer AI-Dienst' : rawStep.dataOutput || 'Internes Zielsystem',
        aiToolId: rawStep.toolIds.find((id) => modelToolIds.has(id)),
        dataCategories: [rawStep.dataInput, rawStep.dataOutput].filter(Boolean) as string[],
        sensitivity: rawStep.dataClassification || 'unclassified',
        direction: external ? 'outbound' : 'internal',
        aiRole: 'ai_input',
        isExternal: external,
        owner: rawStep.owner,
        controlStatus: rawStep.guardrailAction === 'not_defined' || !rawStep.guardrailAction ? 'review_required' : 'covered',
        controlNote: 'Aus der bisherigen schrittbasierten Datenfluss-Dokumentation migriert.',
        linkedPolicyIds: [],
        linkedGuardrailIds: rawStep.guardrailAction === 'mask' ? ['presidio'] : rawStep.guardrailAction === 'not_defined' ? [] : ['safair-guard'],
        monitoringStatus: 'not_connected'
      })
    }
    for (const relation of rawProcess.relations ?? []) {
      if (relation.type !== 'data') continue
      migrated.push({
        id: `flow-migrated-${relation.id}`,
        label: relation.label || 'Migrierter Prozess-Datenfluss',
        sourceProcessId: process.id,
        targetProcessId: relation.targetId,
        sourceSystem: process.name,
        targetSystem: processes.find((item) => item.id === relation.targetId)?.name || '',
        dataCategories: relation.label ? [relation.label] : [],
        sensitivity: 'unclassified',
        direction: 'internal',
        aiRole: 'ai_output',
        isExternal: false,
        owner: process.owner,
        controlStatus: 'review_required',
        controlNote: 'Aus einer unstrukturierten Datenfluss-Verbindung migriert.',
        linkedPolicyIds: [],
        linkedGuardrailIds: [],
        monitoringStatus: 'not_connected'
      })
    }
  }
  return normalizeDataFlows(migrated, processes)
}

export const createComplexDemoProcesses = () => cloneComplexDemo()
export const createDefaultDataFlows = () => cloneDefaultDataFlows()
const storageKey = 'safair-process-map-v5'
const previousStorageKey = 'safair-process-map-v4'
const olderV3StorageKey = 'safair-process-map-v3'
const olderStorageKey = 'safair-process-map-v2'
const legacyStorageKey = 'safair-process-map-v1'

export function isBpmnActivity(step: ProcessStep): boolean {
  return activityBpmnTypes.has(step.bpmnElementType)
}

export function isAiDataFlowStep(step: ProcessStep): boolean {
  return isBpmnActivity(step) && (
    step.executionMode === 'ai_assisted'
    || step.executionMode === 'ai_autonomous'
    || step.toolIds.some((id) => modelToolIds.has(id))
  )
}

export function dataFlowIssues(flow: DataFlow): string[] {
  const issues: string[] = []
  if (!flow.dataCategories.length) issues.push('Datenkategorien fehlen')
  if (flow.sensitivity === 'unclassified') issues.push('Sensitivität nicht klassifiziert')
  if (!flow.owner.trim()) issues.push('Owner fehlt')
  if (!flow.sourceSystem.trim()) issues.push('Quellsystem fehlt')
  if (!flow.targetSystem.trim() && !flow.targetProcessId) issues.push('Ziel fehlt')
  if (flow.isExternal && flow.controlStatus === 'review_required') issues.push('Externe Kontrolle prüfen')
  const hasPiiProtection = flow.linkedGuardrailIds.some((id) => ['presidio', 'scrubadub'].includes(id))
  if (flow.sensitivity === 'personal' && !hasPiiProtection) issues.push('PII-Schutz fehlt')
  if (flow.controlStatus === 'blocked' && !flow.controlNote.trim()) issues.push('Blockiergrund fehlt')
  return issues
}

export function analyzeDataFlowGaps(processes: BusinessProcess[], dataFlows: DataFlow[]): DataFlowGap[] {
  const gaps: DataFlowGap[] = []
  for (const process of processes) {
    const isAiProcess = process.steps.some(isAiDataFlowStep)
    const hasAiInput = dataFlows.some((flow) =>
      (flow.sourceProcessId === process.id || flow.targetProcessId === process.id)
      && ['ai_input', 'retrieval_context'].includes(flow.aiRole)
    )
    if (isAiProcess && !hasAiInput) gaps.push({
      id: `gap-ai-input-${process.id}`,
      type: 'ai_without_input',
      priority: 'medium',
      processId: process.id,
      title: 'AI-Prozess ohne Input-Datenfluss',
      detail: `${process.name} nutzt KI, hat aber keinen dokumentierten Input oder Retrieval-Kontext.`
    })
    for (const relation of process.relations.filter((item) => item.type === 'handoff')) {
      const covered = dataFlows.some((flow) => flow.sourceProcessId === process.id && flow.targetProcessId === relation.targetId && flow.sensitivity !== 'unclassified')
      if (!covered) gaps.push({
        id: `gap-handoff-${process.id}-${relation.id}`,
        type: 'handoff_unclassified',
        priority: 'medium',
        processId: process.id,
        title: 'Prozessübergabe ohne klassifizierte Daten',
        detail: `${relation.label}: Die Übergabe ist fachlich verknüpft, aber noch nicht als Datenfluss klassifiziert.`
      })
    }
  }
  for (const flow of dataFlows) {
    if (flow.isExternal && flow.controlStatus === 'review_required') gaps.push({
      id: `gap-external-${flow.id}`,
      type: 'external_uncontrolled',
      priority: 'high',
      processId: flow.sourceProcessId,
      dataFlowId: flow.id,
      title: 'Externer Datenfluss ohne bestätigte Kontrolle',
      detail: `${flow.label}: Die Kontrolle für ${flow.targetSystem || 'das externe Ziel'} muss geprüft werden.`
    })
    if (flow.sensitivity === 'personal' && !flow.linkedGuardrailIds.some((id) => ['presidio', 'scrubadub'].includes(id))) gaps.push({
      id: `gap-personal-${flow.id}`,
      type: 'personal_unprotected',
      priority: 'high',
      processId: flow.sourceProcessId,
      dataFlowId: flow.id,
      title: 'Personenbezogene Daten ohne PII-Schutz',
      detail: `${flow.label}: Es ist keine PII-Redaktion oder Anonymisierung verknüpft.`
    })
    if (!flow.owner.trim()) gaps.push({
      id: `gap-owner-${flow.id}`,
      type: 'owner_missing',
      priority: 'medium',
      processId: flow.sourceProcessId,
      dataFlowId: flow.id,
      title: 'Datenfluss ohne Owner',
      detail: `${flow.label}: Die Verantwortung ist nicht zugewiesen.`
    })
  }
  return gaps.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1) || a.title.localeCompare(b.title, 'de'))
}

export function calculateProcessMetrics(input: Array<BusinessProcess | ProcessStep>): ProcessMapMetrics {
  const steps = input.flatMap((entry) => 'steps' in entry ? entry.steps : [entry]).filter(isBpmnActivity)
  const automated = steps.filter((step) => step.executionMode !== 'manual')
  const ai = steps.filter((step) => step.executionMode === 'ai_assisted' || step.executionMode === 'ai_autonomous')
  const manual = steps.filter((step) => step.executionMode === 'manual')
  const potential = manual.filter((step) => step.automationPotential === 'partial' || step.automationPotential === 'full')
  const governed = steps.filter((step) => step.owner.trim() && step.control.trim() && (step.risk !== 'high' || step.humanApproval))
  const percent = (part: number, total: number) => total ? Math.round((part / total) * 100) : 0
  return {
    activities: steps.length,
    automatedActivities: automated.length,
    aiActivities: ai.length,
    manualActivities: manual.length,
    potentialActivities: potential.length,
    aiAutonomousActivities: ai.filter((step) => step.executionMode === 'ai_autonomous').length,
    aiHumanApprovalActivities: ai.filter((step) => step.humanApproval).length,
    automationRate: percent(automated.length, steps.length),
    aiShare: percent(ai.length, steps.length),
    automationPotential: percent(potential.length, manual.length),
    aiAutonomy: percent(ai.filter((step) => step.executionMode === 'ai_autonomous').length, ai.length),
    humanOversight: percent(ai.filter((step) => step.humanApproval).length, ai.length),
    governanceScore: percent(governed.length, steps.length)
  }
}

export function useProcessMap() {
  const processes = useState<BusinessProcess[]>('business-processes', cloneDefaults)
  const dataFlows = useState<DataFlow[]>('data-flows', cloneDefaultDataFlows)
  const bpmnDocuments = useState<BpmnDocument[]>('bpmn-documents', () => [])
  const demoPreset = useState<DemoPreset>('process-demo-preset', () => 'compact')
  const storageLoaded = useState<boolean>('business-processes-loaded', () => false)

  onMounted(() => {
    if (storageLoaded.value) return
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as { processes?: RawBusinessProcess[]; dataFlows?: RawDataFlow[]; bpmnDocuments?: BpmnDocument[]; demoPreset?: DemoPreset }
        const rawProcesses = parsed.processes ?? []
        processes.value = normalizeProcesses(rawProcesses)
        dataFlows.value = normalizeDataFlows(parsed.dataFlows ?? [], processes.value)
        bpmnDocuments.value = Array.isArray(parsed.bpmnDocuments) ? parsed.bpmnDocuments : []
        demoPreset.value = parsed.demoPreset ?? 'custom'
      } else {
        const legacy = localStorage.getItem(previousStorageKey) ?? localStorage.getItem(olderV3StorageKey) ?? localStorage.getItem(olderStorageKey) ?? localStorage.getItem(legacyStorageKey)
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy) as RawBusinessProcess[] | { processes?: RawBusinessProcess[]; dataFlows?: RawDataFlow[]; bpmnDocuments?: BpmnDocument[]; demoPreset?: DemoPreset }
          if (Array.isArray(parsedLegacy)) {
            processes.value = normalizeProcesses(parsedLegacy)
            dataFlows.value = migrateLegacyDataFlows(parsedLegacy, processes.value)
            demoPreset.value = 'custom'
          } else {
            const rawProcesses = parsedLegacy.processes ?? []
            processes.value = normalizeProcesses(rawProcesses)
            dataFlows.value = parsedLegacy.dataFlows?.length
              ? normalizeDataFlows(parsedLegacy.dataFlows, processes.value)
              : migrateLegacyDataFlows(rawProcesses, processes.value)
            bpmnDocuments.value = Array.isArray(parsedLegacy.bpmnDocuments) ? parsedLegacy.bpmnDocuments : []
            demoPreset.value = parsedLegacy.demoPreset ?? 'custom'
          }
        }
        localStorage.setItem(storageKey, JSON.stringify({ processes: processes.value, dataFlows: dataFlows.value, bpmnDocuments: bpmnDocuments.value, demoPreset: demoPreset.value }))
      }
    } catch {
      // Keep the curated defaults when browser data is unavailable or invalid.
    }
    storageLoaded.value = true
  })

  watch([processes, dataFlows, bpmnDocuments, demoPreset], () => {
    if (!import.meta.client || !storageLoaded.value) return
    localStorage.setItem(storageKey, JSON.stringify({ processes: processes.value, dataFlows: dataFlows.value, bpmnDocuments: bpmnDocuments.value, demoPreset: demoPreset.value }))
  }, { deep: true })

  const metrics = computed(() => calculateProcessMetrics(processes.value))
  const totalSteps = computed(() => metrics.value.activities)
  const aiEnabledSteps = computed(() => metrics.value.aiActivities)
  const coverage = computed(() => metrics.value.aiShare)
  const dataFlowGaps = computed(() => analyzeDataFlowGaps(processes.value, dataFlows.value))
  const assignedToolIds = computed(() => new Set(
    processes.value.flatMap((process) => process.steps.flatMap((step) => step.toolIds))
  ))
  const openHighRisks = computed(() => processes.value.flatMap((process) =>
    process.steps
      .filter((step) => step.risk === 'high' && (!step.control.trim() || (step.executionMode.startsWith('ai_') && !step.humanApproval)))
      .map((step) => ({ process, step }))
  ))

  function findTool(id: string) {
    return aiToolCatalog.find((tool) => tool.id === id)
  }

  function markCustom() {
    demoPreset.value = 'custom'
  }

  function toggleTool(step: ProcessStep, toolId: string) {
    const index = step.toolIds.indexOf(toolId)
    if (index >= 0) step.toolIds.splice(index, 1)
    else step.toolIds.push(toolId)
    synchronizeExecutionModeForModelTool(step, toolId)
    markCustom()
  }

  function addDataFlow(input: Omit<DataFlow, 'id'> & { id?: string }) {
    const baseId = input.id || `data-flow-${Date.now()}`
    let id = baseId
    let suffix = 2
    while (dataFlows.value.some((flow) => flow.id === id)) id = `${baseId}-${suffix++}`
    const normalized = normalizeDataFlows([{ ...input, id }], processes.value)[0]
    if (!normalized) return null
    dataFlows.value.push(normalized)
    markCustom()
    return normalized
  }

  function updateDataFlow(id: string, patch: Partial<Omit<DataFlow, 'id' | 'sourceProcessId'>>) {
    const flow = dataFlows.value.find((item) => item.id === id)
    if (!flow) return null
    const normalized = normalizeDataFlows([{ ...flow, ...patch }], processes.value)[0]
    if (!normalized) return null
    Object.assign(flow, normalized)
    markCustom()
    return flow
  }

  function removeDataFlow(id: string) {
    const index = dataFlows.value.findIndex((flow) => flow.id === id)
    if (index < 0) return false
    dataFlows.value.splice(index, 1)
    markCustom()
    return true
  }

  function addProcess(name: string, owner: string, landscapeLayer: LandscapeLayer = 'support', domain = 'Fachbereich') {
    const id = `process-${Date.now()}`
    processes.value.push({
      id,
      name,
      description: 'Neuer Geschäftsprozess – Beschreibung und Governance-Details ergänzen.',
      owner: owner || 'Noch nicht zugewiesen',
      status: 'planned',
      maturity: 20,
      volume: 'Volumen noch offen',
      landscapeLayer,
      domain: domain || 'Fachbereich',
      relations: [],
      steps: [
        {
          id: `${id}-step-1`,
          title: 'Prozessschritt 1',
          description: 'Beschreibung des Prozessschritts ergänzen.',
          owner: owner || 'Noch nicht zugewiesen',
          department: 'Fachbereich',
          risk: 'medium',
          toolIds: [],
          humanApproval: true,
          control: 'Kontrollmaßnahme definieren.',
          workflowType: 'trigger',
          bpmnElementType: 'bpmn:StartEvent',
          executionMode: 'manual',
          automationPotential: 'none',
          position: { x: 80, y: 160 }
        }
      ],
      connections: []
    })
    markCustom()
    return id
  }

  function addStep(process: BusinessProcess) {
    const previous = process.steps.at(-1)
    if (previous?.workflowType === 'end') {
      previous.workflowType = 'task'
      previous.bpmnElementType = 'bpmn:Task'
      previous.automationPotential = 'partial'
    }
    const step: ProcessStep = {
      id: `${process.id}-step-${Date.now()}`,
      title: `Prozessschritt ${process.steps.length + 1}`,
      description: 'Beschreibung des Prozessschritts ergänzen.',
      owner: process.owner,
      department: 'Fachbereich',
      risk: 'medium',
      toolIds: [],
      humanApproval: true,
      control: 'Kontrollmaßnahme definieren.',
      workflowType: 'end',
      bpmnElementType: 'bpmn:EndEvent',
      executionMode: 'manual',
      automationPotential: 'none',
      position: { x: Math.max(80, ...process.steps.map((item) => item.position.x + 270)), y: 160 }
    }
    process.steps.push(step)
    if (previous) addConnection(process, { source: previous.id, target: step.id })
    markCustom()
    return step
  }

  function addWorkflowStep(process: BusinessProcess, workflowType: WorkflowNodeType) {
    const labels: Record<WorkflowNodeType, string> = {
      trigger: 'Neuer Auslöser',
      task: 'Neue Aufgabe',
      ai: 'KI-Verarbeitung',
      decision: 'Entscheidung',
      approval: 'Manuelle Freigabe',
      end: 'Prozessende'
    }
    const id = `${process.id}-${workflowType}-${Date.now()}`
    const step: ProcessStep = {
      id,
      title: labels[workflowType],
      description: 'Beschreibung und Workflow-Logik für diesen Schritt ergänzen.',
      owner: process.owner,
      department: workflowType === 'ai' ? 'AI Operations' : 'Fachbereich',
      risk: workflowType === 'ai' || workflowType === 'decision' ? 'high' : 'medium',
      toolIds: [],
      humanApproval: workflowType === 'approval',
      control: workflowType === 'approval' ? 'Manuelle Freigabe dokumentieren.' : 'Kontrollmaßnahme definieren.',
      workflowType,
      bpmnElementType: inferBpmnElementType({
        id, title: labels[workflowType], description: '', owner: process.owner, department: '', risk: 'medium', toolIds: [], humanApproval: workflowType === 'approval', control: ''
      }, workflowType),
      executionMode: workflowType === 'ai' ? 'ai_assisted' : 'manual',
      automationPotential: workflowType === 'task' || workflowType === 'approval' ? 'partial' : workflowType === 'ai' ? 'full' : 'none',
      position: {
        x: Math.max(80, ...process.steps.map((item) => item.position.x + 270)),
        y: 140 + (process.steps.length % 3) * 70
      }
    }
    process.steps.push(step)
    markCustom()
    return step
  }

  function addConnection(
    process: BusinessProcess,
    connection: { source: string; target: string; sourceHandle?: string | null }
  ) {
    if (connection.source === connection.target) return null
    const duplicate = process.connections.find((edge) =>
      edge.source === connection.source
      && edge.target === connection.target
      && (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null)
    )
    if (duplicate) return duplicate

    const condition = connection.sourceHandle === 'yes'
      ? 'yes'
      : connection.sourceHandle === 'no'
        ? 'no'
        : 'always'
    const edge: WorkflowConnection = {
      id: `${process.id}-edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      condition,
      label: condition === 'yes' ? 'Ja' : condition === 'no' ? 'Nein' : undefined
    }
    process.connections.push(edge)
    markCustom()
    return edge
  }

  function removeConnection(process: BusinessProcess, connectionId: string) {
    const index = process.connections.findIndex((edge) => edge.id === connectionId)
    if (index >= 0) process.connections.splice(index, 1)
    markCustom()
  }

  function removeStep(process: BusinessProcess, stepId: string) {
    if (process.steps.length <= 1) return false
    const index = process.steps.findIndex((step) => step.id === stepId)
    if (index < 0) return false
    process.steps.splice(index, 1)
    process.connections = process.connections.filter((edge) => edge.source !== stepId && edge.target !== stepId)
    dataFlows.value.filter((flow) => flow.sourceProcessId === process.id && flow.sourceStepId === stepId).forEach((flow) => { flow.sourceStepId = undefined })
    markCustom()
    return true
  }

  function updateStepPosition(process: BusinessProcess, stepId: string, position: WorkflowPosition) {
    const step = process.steps.find((item) => item.id === stepId)
    if (step) step.position = { x: Math.round(position.x), y: Math.round(position.y) }
    markCustom()
  }

  function resetProcesses() {
    loadDemoPreset('compact')
  }

  function loadDemoPreset(preset: Exclude<DemoPreset, 'custom'>) {
    processes.value = preset === 'complex' ? cloneComplexDemo() : cloneDefaults()
    dataFlows.value = preset === 'complex' ? complexDemoDataFlows(processes.value) : cloneDefaultDataFlows()
    bpmnDocuments.value = []
    demoPreset.value = preset
  }

  function addImportedProcesses(importedProcesses: BusinessProcess[], document?: BpmnDocument) {
    const importedIds: string[] = []
    const documentClone = document ? JSON.parse(JSON.stringify(document)) as BpmnDocument : null
    if (documentClone) {
      let documentId = documentClone.id || `bpmn-document-${Date.now()}`
      let suffix = 2
      while (bpmnDocuments.value.some((item) => item.id === documentId)) documentId = `${documentClone.id}-${suffix++}`
      documentClone.id = documentId
      documentClone.updatedAt = new Date().toISOString()
      bpmnDocuments.value.push(documentClone)
    }
    for (const imported of importedProcesses) {
      const clone = JSON.parse(JSON.stringify(imported)) as BusinessProcess
      const baseId = clone.id || `imported-process-${Date.now()}`
      let id = baseId
      let suffix = 2
      while (processes.value.some((process) => process.id === id)) id = `${baseId}-${suffix++}`
      clone.id = id
      const importedDataRelations = clone.relations.filter((relation) => relation.type === 'data')
      clone.relations = clone.relations.filter((relation) => relation.type !== 'data')
      if (documentClone) clone.bpmnDocumentId = documentClone.id
      processes.value.push(clone)
      for (const relation of importedDataRelations) {
        addDataFlow({
          label: relation.label || 'Importierter Datenfluss',
          sourceProcessId: clone.id,
          targetProcessId: relation.targetId,
          sourceSystem: clone.name,
          targetSystem: processes.value.find((process) => process.id === relation.targetId)?.name || '',
          dataCategories: relation.label ? [relation.label] : [],
          sensitivity: 'unclassified',
          direction: 'internal',
          aiRole: 'ai_output',
          isExternal: false,
          owner: clone.owner,
          controlStatus: 'review_required',
          controlNote: 'Beim BPMN-Import als Datenfluss erkannt; Klassifizierung prüfen.',
          linkedPolicyIds: [],
          linkedGuardrailIds: [],
          monitoringStatus: 'not_connected'
        })
      }
      importedIds.push(id)
    }
    markCustom()
    return importedIds
  }

  function getBpmnDocument(process: BusinessProcess | undefined) {
    if (!process?.bpmnDocumentId) return undefined
    return bpmnDocuments.value.find((document) => document.id === process.bpmnDocumentId)
  }

  function setBpmnDocument(process: BusinessProcess, xml: string, processRefs = [process.bpmnProcessRef || process.id]) {
    let document = getBpmnDocument(process)
    if (!document) {
      document = {
        id: `bpmn-document-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        xml,
        processRefs,
        updatedAt: new Date().toISOString()
      }
      bpmnDocuments.value.push(document)
      process.bpmnDocumentId = document.id
    } else {
      document.xml = xml
      document.processRefs = processRefs
      document.updatedAt = new Date().toISOString()
    }
    markCustom()
    return document
  }

  function updateProcessesFromDocument(documentId: string, importedProcesses: BusinessProcess[]) {
    for (const imported of importedProcesses) {
      const existing = processes.value.find((process) => process.bpmnDocumentId === documentId && process.bpmnProcessRef === imported.bpmnProcessRef)
        ?? processes.value.find((process) => process.bpmnDocumentId === documentId && process.id === imported.id)
      if (!existing) continue
      existing.steps = imported.steps
      existing.connections = imported.connections
      existing.name = imported.name || existing.name
    }
    markCustom()
  }

  function addProcessRelation(
    sourceId: string,
    targetId: string,
    type: ProcessRelationType,
    label: string
  ) {
    const source = processes.value.find((process) => process.id === sourceId)
    if (!source || sourceId === targetId || !processes.value.some((process) => process.id === targetId)) return null
    const duplicate = source.relations.find((relation) => relation.targetId === targetId && relation.type === type)
    if (duplicate) {
      duplicate.label = label || duplicate.label
      return duplicate
    }
    const relation: ProcessRelation = {
      id: `${sourceId}-relation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetId,
      type,
      label: label || 'Prozessübergabe'
    }
    source.relations.push(relation)
    markCustom()
    return relation
  }

  function removeProcessRelation(sourceId: string, relationId: string) {
    const source = processes.value.find((process) => process.id === sourceId)
    if (!source) return
    const index = source.relations.findIndex((relation) => relation.id === relationId)
    if (index >= 0) source.relations.splice(index, 1)
    markCustom()
  }

  return {
    processes,
    dataFlows,
    bpmnDocuments,
    demoPreset,
    tools: aiToolCatalog,
    metrics,
    totalSteps,
    aiEnabledSteps,
    coverage,
    dataFlowGaps,
    assignedToolIds,
    openHighRisks,
    findTool,
    toggleTool,
    addDataFlow,
    updateDataFlow,
    removeDataFlow,
    addProcess,
    addStep,
    addWorkflowStep,
    addConnection,
    removeConnection,
    removeStep,
    updateStepPosition,
    addImportedProcesses,
    getBpmnDocument,
    setBpmnDocument,
    updateProcessesFromDocument,
    addProcessRelation,
    removeProcessRelation,
    resetProcesses,
    loadDemoPreset,
    markCustom
  }
}
