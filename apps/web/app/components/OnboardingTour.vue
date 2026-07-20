<script setup lang="ts">
type TourStep = {
  eyebrow: string
  title: string
  description: string
  target?: string
}

type StoredTourState = {
  version: number
  status: 'completed' | 'skipped'
  seenAt: string
}

const props = withDefaults(defineProps<{
  steps?: TourStep[]
  storageKey?: string
  version?: number
  autoStart?: boolean
  autoStartDelay?: number
  stepDelay?: number
}>(), {
  steps: undefined,
  storageKey: 'safair:onboarding-tour',
  version: 2,
  autoStart: true,
  autoStartDelay: 650,
  stepDelay: 0
})

const emit = defineEmits<{
  navigationVisibility: [visible: boolean]
  stepChange: [index: number]
}>()

const defaultSteps: TourStep[] = [
  {
    eyebrow: 'Willkommen bei safAIr',
    title: 'Ihr AI-Governance Workspace',
    description: 'In weniger als einer Minute zeigen wir Ihnen, wo Management-Kennzahlen, Prozesse, Risiken und der technische Betrieb zusammenlaufen.'
  },
  {
    eyebrow: '01 · Management',
    title: 'Die Lage auf einen Blick',
    description: 'Das Management Dashboard trennt Automatisierungsgrad, KI-Anteil und zusätzliches Automatisierungspotenzial und bündelt diese Werte mit Governance Score und Handlungsfeldern.',
    target: '[data-onboarding="dashboard-link"]'
  },
  {
    eyebrow: '02 · Prozesse',
    title: 'Vom Portfolio bis zum nativen BPMN',
    description: 'In der Prozesslandkarte sehen Sie Abteilungen und Übergaben. Im Designer bearbeiten Sie echtes BPMN, nutzen Aufräumen und Vollbild oder lassen aus Text und Sprache einen prüfbaren Entwurf erzeugen.',
    target: '[data-onboarding="process-map-link"]'
  },
  {
    eyebrow: '03 · Betrieb',
    title: 'Services und Endpunkte überwachen',
    description: 'Das Monitoring zeigt Verfügbarkeit, Latenzen und Probleme der Plattform sowie der angeschlossenen AI-Services.',
    target: '[data-onboarding="monitoring-link"]'
  },
  {
    eyebrow: '04 · Governance',
    title: 'Regeln und Tool-Inventar verbinden',
    description: 'Policies und der AI-Tool-Katalog bilden die Governance-Ebene über der Prozesslandschaft und schaffen nachvollziehbare Verantwortlichkeiten.',
    target: '[data-onboarding="governance-group"]'
  },
  {
    eyebrow: '05 · Entwicklung',
    title: 'API-Dokumentation für Integrationen',
    description: 'Entwickler finden hier die interaktive Swagger-Dokumentation und können geschützte Endpunkte direkt nachvollziehen.',
    target: '[data-onboarding="api-docs-link"]'
  },
  {
    eyebrow: '06 · Navigation',
    title: 'Mehr Platz mit der Icon-Leiste',
    description: 'Auf dem Desktop lässt sich die Sidebar dauerhaft einklappen. Während einer Tour öffnet sie sich automatisch und kehrt danach in den gespeicherten Zustand zurück.',
    target: '[data-onboarding="sidebar-shell"]'
  },
  {
    eyebrow: 'Geschafft',
    title: 'Sie können jederzeit zurückkehren',
    description: 'Über „Einführung starten“ lässt sich diese Tour jederzeit erneut öffnen. Der Abschluss wird nur in diesem Browser gespeichert.',
    target: '[data-onboarding="onboarding-restart"]'
  }
]

const tourSteps = computed(() => props.steps?.length ? props.steps : defaultSteps)

const active = ref(false)
const currentIndex = ref(0)
const panel = ref<HTMLElement>()
const highlightStyle = ref<Record<string, string>>({})
const panelStyle = ref<Record<string, string>>({
  width: 'min(390px, calc(100vw - 32px))',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)'
})
const hasTarget = ref(false)
let panelObserver: ResizeObserver | undefined

const currentStep = computed(() => tourSteps.value[currentIndex.value] ?? tourSteps.value[0]!)
const isLastStep = computed(() => currentIndex.value === tourSteps.value.length - 1)
const progressLabel = computed(() => `${currentIndex.value + 1} von ${tourSteps.value.length}`)

function readStoredState() {
  try {
    const raw = localStorage.getItem(props.storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredTourState>
    return parsed.version === props.version && (parsed.status === 'completed' || parsed.status === 'skipped')
      ? parsed
      : null
  } catch {
    return null
  }
}

function storeState(status: StoredTourState['status']) {
  try {
    localStorage.setItem(props.storageKey, JSON.stringify({
      version: props.version,
      status,
      seenAt: new Date().toISOString()
    } satisfies StoredTourState))
  } catch {
    // The tour still works when storage is unavailable (for example in private mode).
  }
}

function targetElement() {
  if (!currentStep.value.target) return null
  return document.querySelector<HTMLElement>(currentStep.value.target)
}

function placePanel(rect: DOMRect | null) {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const margin = 16
  const gap = 18
  const width = Math.min(390, viewportWidth - margin * 2)
  const panelHeight = Math.min(panel.value?.offsetHeight ?? 300, viewportHeight - margin * 2)
  const maxTop = Math.max(margin, viewportHeight - panelHeight - margin)

  if (!rect || viewportWidth <= 700) {
    panelStyle.value = {
      width: `${width}px`,
      left: `${Math.max(margin, (viewportWidth - width) / 2)}px`,
      top: viewportWidth <= 700
        ? `${maxTop}px`
        : `${Math.min(maxTop, Math.max(margin, (viewportHeight - panelHeight) / 2))}px`
    }
    return
  }

  let left = rect.right + gap
  let top = rect.top + Math.min(24, rect.height / 4)

  if (left + width > viewportWidth - margin) left = rect.left - width - gap
  if (left < margin) {
    left = Math.min(viewportWidth - width - margin, Math.max(margin, rect.left))
    top = rect.bottom + gap
    if (top + panelHeight > viewportHeight - margin) top = rect.top - panelHeight - gap
  }

  panelStyle.value = {
    width: `${width}px`,
    left: `${Math.min(viewportWidth - width - margin, Math.max(margin, left))}px`,
    top: `${Math.min(maxTop, Math.max(margin, top))}px`
  }
}

async function updatePosition(scrollTarget = false) {
  if (!active.value) return
  const target = targetElement()
  hasTarget.value = Boolean(target)

  if (!target) {
    highlightStyle.value = {}
    await nextTick()
    placePanel(null)
    return
  }

  if (scrollTarget) target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  const rect = target.getBoundingClientRect()
  const padding = 7
  highlightStyle.value = {
    width: `${rect.width + padding * 2}px`,
    height: `${rect.height + padding * 2}px`,
    left: `${rect.left - padding}px`,
    top: `${rect.top - padding}px`
  }
  placePanel(rect)
}

function stepUsesNavigation() {
  return Boolean(currentStep.value.target && targetElement()?.closest('.sidebar'))
}

async function showStep(index: number) {
  currentIndex.value = Math.min(Math.max(index, 0), tourSteps.value.length - 1)
  emit('stepChange', currentIndex.value)
  await nextTick()
  const navigationStep = stepUsesNavigation()
  emit('navigationVisibility', navigationStep)
  const delay = Math.max(navigationStep ? 220 : 0, props.stepDelay)
  if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay))
  await updatePosition(true)
  await nextTick()
  panel.value?.focus({ preventScroll: true })
}

function start() {
  active.value = true
  nextTick(() => {
    panelObserver?.disconnect()
    if (panel.value && typeof ResizeObserver !== 'undefined') {
      panelObserver = new ResizeObserver(() => void updatePosition())
      panelObserver.observe(panel.value)
    }
    void showStep(0)
  })
}

function finish(status: StoredTourState['status']) {
  storeState(status)
  active.value = false
  panelObserver?.disconnect()
  emit('navigationVisibility', false)
}

function next() {
  if (isLastStep.value) {
    finish('completed')
    return
  }
  void showStep(currentIndex.value + 1)
}

function previous() {
  if (currentIndex.value > 0) void showStep(currentIndex.value - 1)
}

function handleKeydown(event: KeyboardEvent) {
  if (!active.value) return
  if (event.key === 'Escape') finish('skipped')
  if (event.key === 'ArrowRight') next()
  if (event.key === 'ArrowLeft') previous()
}

function handleViewportChange() {
  void updatePosition()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)

  if (props.autoStart && !readStoredState()) window.setTimeout(start, props.autoStartDelay)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
  panelObserver?.disconnect()
})

defineExpose({ start })
</script>

<template>
  <Teleport to="body">
    <Transition name="tour-fade">
      <div v-if="active" class="tour" aria-live="polite">
        <div class="tour-capture" :class="{ 'tour-capture--centered': !hasTarget }" @click.stop />
        <div v-if="hasTarget" class="tour-highlight" :style="highlightStyle" aria-hidden="true" />

        <section
          ref="panel"
          class="tour-panel"
          :style="panelStyle"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-description"
          tabindex="-1"
        >
          <div class="tour-meta">
            <span>{{ currentStep.eyebrow }}</span>
            <span>{{ progressLabel }}</span>
          </div>
          <h2 id="tour-title">{{ currentStep.title }}</h2>
          <p id="tour-description">{{ currentStep.description }}</p>

          <div class="tour-progress" aria-hidden="true">
            <i v-for="(_, index) in tourSteps" :key="index" :class="{ active: index <= currentIndex }" />
          </div>

          <div class="tour-actions">
            <button class="tour-skip" @click="finish('skipped')">Überspringen</button>
            <div>
              <button v-if="currentIndex > 0" class="tour-back" aria-label="Vorheriger Schritt" @click="previous">Zurück</button>
              <button class="tour-next" @click="next">
                {{ isLastStep ? 'Tour abschließen' : 'Weiter' }}
                <span aria-hidden="true">{{ isLastStep ? '✓' : '→' }}</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tour { position: fixed; z-index: 2000; inset: 0; }
.tour-capture { position: fixed; z-index: 1; inset: 0; background: transparent; cursor: default; }
.tour-capture--centered { background: rgba(16, 16, 14, .72); backdrop-filter: blur(3px); }
.tour-highlight {
  position: fixed;
  z-index: 2;
  border: 2px solid var(--acid);
  border-radius: 4px;
  box-shadow: 0 0 0 9999px rgba(16, 16, 14, .72), 0 0 0 5px rgba(216, 255, 85, .22);
  pointer-events: none;
  transition: top 180ms ease, left 180ms ease, width 180ms ease, height 180ms ease;
}
.tour-panel {
  position: fixed;
  z-index: 3;
  max-height: calc(100vh - 32px);
  padding: 27px;
  overflow-y: auto;
  border: 1px solid var(--ink);
  border-top: 5px solid var(--blue);
  background: var(--surface-raised);
  color: var(--ink);
  box-shadow: 0 28px 90px rgba(0, 0, 0, .32);
  outline: none;
  overscroll-behavior: contain;
}
.tour-meta { display: flex; align-items: center; justify-content: space-between; gap: 18px; color: #354dcc; font-size: 10px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
.tour-meta span:last-child { color: var(--ink-soft); letter-spacing: .04em; }
.tour-panel h2 { margin: 42px 0 13px; color: var(--ink); font-size: clamp(28px, 4vw, 39px); font-weight: 560; line-height: .95; letter-spacing: -.055em; }
.tour-panel > p { margin: 0; color: var(--ink-soft); font-size: 14px; line-height: 1.65; }
.tour-progress { margin: 27px 0 23px; display: flex; gap: 5px; }
.tour-progress i { flex: 1; }
.tour-progress i { height: 3px; background: var(--surface-soft); transition: background 160ms ease; }
.tour-progress i.active { background: var(--blue); }
.tour-actions { margin: 0 -8px -8px; padding: 13px 8px 8px; position: sticky; z-index: 2; bottom: -1px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border-top: 1px solid var(--border); background: var(--surface-raised); }
.tour-actions > div { display: flex; gap: 8px; }
.tour-panel button { min-height: 38px; padding: 0 13px; font-size: 10px; }
.tour-panel button:hover { transform: none; }
.tour-skip { padding-left: 0 !important; border-color: transparent !important; background: transparent !important; color: var(--ink-soft) !important; }
.tour-skip:hover { color: var(--ink) !important; }
.tour-back { border-color: var(--border-strong) !important; background: transparent !important; color: var(--ink) !important; }
.tour-next span { font-size: 15px; }
.tour-fade-enter-active, .tour-fade-leave-active { transition: opacity 180ms ease; }
.tour-fade-enter-from, .tour-fade-leave-to { opacity: 0; }

@media (max-width: 700px) {
  .tour-panel { padding: 22px; }
  .tour-panel h2 { margin-top: 28px; font-size: 30px; }
  .tour-panel > p { font-size: 13px; }
  .tour-actions { align-items: stretch; flex-direction: column-reverse; }
  .tour-actions > div { display: grid; grid-template-columns: auto 1fr; }
  .tour-actions > div .tour-next:only-child { grid-column: 1 / -1; }
  .tour-skip { align-self: center; }
}

@media (prefers-reduced-motion: reduce) {
  .tour-highlight, .tour-fade-enter-active, .tour-fade-leave-active { transition: none; }
}
</style>
