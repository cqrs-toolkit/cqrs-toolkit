import type { Component, JSX } from 'solid-js'
import type { EventEntry, EventListItem, EventsStore } from '../stores/events.js'
import { formatTime } from '../utils/format.js'

interface EventRowProps {
  item: EventListItem
  columns: string
  selected: boolean
  onSelect: () => void
  getProcessorResult: EventsStore['getProcessorResult']
}

export const EventRow: Component<EventRowProps> = (props) => {
  return <>{renderItem(props)}</>
}

function renderItem(props: EventRowProps): JSX.Element {
  const item = props.item

  switch (item.kind) {
    case 'event':
      return (
        <EventDataRow
          entry={item.entry}
          columns={props.columns}
          selected={props.selected}
          onSelect={props.onSelect}
          hasProcessorResult={props.getProcessorResult(item.entry.event.id) !== undefined}
        />
      )
    case 'gap-detected':
      return (
        <GapBanner class="gap-banner gap-banner-detected">
          Gap detected on {item.streamId}: expected rev {item.expected}, got {item.received}
        </GapBanner>
      )
    case 'gap-repair-started':
      return (
        <GapBanner class="gap-banner gap-banner-started">
          Gap repair started on {item.streamId} from rev {item.fromRevision}
        </GapBanner>
      )
    case 'gap-repair-completed':
      return (
        <GapBanner class="gap-banner gap-banner-completed">
          Gap repair completed on {item.streamId}: {item.eventCount} events fetched
        </GapBanner>
      )
    case 'session-divider':
      return (
        <div class="session-divider">
          <hr />
          <span>Session: {item.userId || 'anonymous'}</span>
          <hr />
        </div>
      )
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface EventDataRowProps {
  entry: EventEntry
  columns: string
  selected: boolean
  onSelect: () => void
  hasProcessorResult: boolean
}

const EventDataRow: Component<EventDataRowProps> = (props) => {
  const evt = () => props.entry.event
  const persistenceLetter = () => {
    const p = evt().persistence
    if (p === 'Stateful') return 'S'
    if (p === 'Anticipated') return 'A'
    return 'P'
  }
  const persistenceClass = () => {
    const p = evt().persistence
    if (p === 'Stateful') return 'persistence-stateful'
    if (p === 'Anticipated') return 'persistence-anticipated'
    return 'persistence-permanent'
  }

  return (
    <div
      class={`event-row ${props.selected ? 'selected' : ''}`}
      style={{ display: 'grid', 'grid-template-columns': props.columns }}
      onClick={() => props.onSelect()}
    >
      <span class="event-col-time">{formatTime(props.entry.timestamp)}</span>
      <span class="event-col-type" title={evt().type}>
        {evt().type}
      </span>
      <span class="event-col-stream" title={evt().streamId}>
        {evt().streamId.slice(0, 8)}
      </span>
      <span class="event-col-rev">{evt().revision}</span>
      <span class={`event-col-persistence ${persistenceClass()}`}>{persistenceLetter()}</span>
      <span class="event-col-processed">{props.hasProcessorResult ? '\u2713' : ''}</span>
    </div>
  )
}

interface GapBannerProps {
  class: string
  children: JSX.Element
}

const GapBanner: Component<GapBannerProps> = (props) => {
  return <div class={props.class}>{props.children}</div>
}
