import { setup, assign } from 'xstate'

/** Shape dimensions for each island state */
export const ISLAND_SIZES = {
  idle: { width: 140, height: 36, borderRadius: 18 },
  compact: { width: 220, height: 38, borderRadius: 19 },
  listening: { width: 280, height: 52, borderRadius: 26 },
  expanded: { width: 440, height: 150, borderRadius: 32 },
  alert: { width: 400, height: 84, borderRadius: 28 }
} as const

export type IslandState = keyof typeof ISLAND_SIZES

export interface AlertPayload {
  title: string
  message?: string
  type?: 'info' | 'warning' | 'success' | 'error'
}

export interface IslandContext {
  alert: AlertPayload | null
  previousState: IslandState
}

export type IslandEvent =
  | { type: 'HOVER' }
  | { type: 'CLICK' }
  | { type: 'OUTSIDE' }
  | { type: 'LISTEN_START' }
  | { type: 'LISTEN_END' }
  | { type: 'ALERT'; payload: AlertPayload }
  | { type: 'DISMISS' }

export const islandMachine = setup({
  types: {
    context: {} as IslandContext,
    events: {} as IslandEvent
  },
  delays: {
    IDLE_TIMEOUT: 4000
  }
}).createMachine({
  id: 'island',
  initial: 'idle',
  context: {
    alert: null,
    previousState: 'idle'
  },
  states: {
    idle: {
      on: {
        HOVER: { target: 'compact', actions: assign({ previousState: 'idle' }) },
        CLICK: { target: 'expanded', actions: assign({ previousState: 'idle' }) },
        LISTEN_START: { target: 'listening', actions: assign({ previousState: 'idle' }) },
        ALERT: {
          target: 'alert',
          actions: assign({
            alert: ({ event }) => event.payload,
            previousState: 'idle'
          })
        }
      }
    },
    compact: {
      after: {
        IDLE_TIMEOUT: { target: 'idle' }
      },
      on: {
        CLICK: { target: 'expanded', actions: assign({ previousState: 'compact' }) },
        OUTSIDE: { target: 'idle' },
        LISTEN_START: { target: 'listening', actions: assign({ previousState: 'compact' }) },
        ALERT: {
          target: 'alert',
          actions: assign({
            alert: ({ event }) => event.payload,
            previousState: 'compact'
          })
        }
      }
    },
    listening: {
      on: {
        LISTEN_END: { target: 'idle' },
        ALERT: {
          target: 'alert',
          actions: assign({
            alert: ({ event }) => event.payload,
            previousState: 'listening'
          })
        }
      }
    },
    expanded: {
      after: {
        IDLE_TIMEOUT: { target: 'idle' }
      },
      on: {
        OUTSIDE: { target: 'idle' },
        LISTEN_START: { target: 'listening', actions: assign({ previousState: 'expanded' }) },
        ALERT: {
          target: 'alert',
          actions: assign({
            alert: ({ event }) => event.payload,
            previousState: 'expanded'
          })
        }
      }
    },
    alert: {
      after: {
        IDLE_TIMEOUT: { target: 'idle', actions: assign({ alert: null }) }
      },
      on: {
        DISMISS: { target: 'idle', actions: assign({ alert: null }) },
        ALERT: {
          target: 'alert',
          actions: assign({
            alert: ({ event }) => event.payload
          }),
          reenter: true
        }
      }
    }
  }
})
