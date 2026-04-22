import { createConsoleLogger, ILogger, Level } from '@meticoeus/ddd-es'
import type { IDebugEventSink } from '../../core/events/index.js'

type LogFn = ILogger['info']

/**
 * Resolve which logger to install at bootstrap.
 *
 * Precedence:
 * 1. `config.logger` — consumer-provided logger wins verbatim (Pino, custom
 *    transport, etc.). Honoured regardless of `debug`.
 * 2. `config.debug` — built-in {@link EventBusLogger} against `sink` so
 *    `debug:log` events surface on the relevant library event stream.
 * 3. Otherwise — plain console logger at `warn`.
 *
 * Shared by the main-thread bootstraps in `createCqrsClient` and the
 * worker entry points (`startDedicatedWorker`, `startSharedWorker`); each
 * passes the appropriate sink (adapter's bus on main-thread online-only,
 * channel on main-thread worker mode, worker-side bus inside the worker).
 */
export function resolveLogger(
  config: { logger?: ILogger; debug?: boolean },
  sink: IDebugEventSink<any>,
): ILogger {
  if (config.logger) return config.logger
  if (config.debug) return new EventBusLogger(sink)
  return createConsoleLogger({ level: 'warn' })
}

/**
 * Logger that emits a `debug:log` event on an {@link IDebugEventSink} AND
 * forwards to a console logger so the same line shows up in stdout/DevTools
 * with the usual coloured formatting.
 *
 * **App usage:** construct with a fixed sink — `new EventBusLogger(sink)`.
 * The sink lives for the life of the process and every log call goes to both
 * the sink and the console. In online-only mode the sink is the main
 * {@link EventBus}; in worker mode it's a main-thread-local sink backed by a
 * subject that's merged into `client.events$` so logs stay on this thread.
 *
 * **Test usage:** construct with no sink — `new EventBusLogger()` — and call
 * {@link setSink} at the start of each test with that test's fresh sink.
 * When no sink is set, log calls fall through to the console only; if the
 * stored sink has been completed by the time a log fires (e.g. teardown
 * timing), emission is dropped silently and the console path still runs.
 *
 * The console side delegates to {@link createConsoleLogger} so formatting
 * and level behaviour aren't duplicated.
 *
 * @param sink - Debug event sink to emit `debug:log` events on. Omit for
 *               test setups that swap the sink per run via {@link setSink}.
 *               Consumers are expected to construct this logger only in
 *               debug mode — the sink does not self-gate.
 * @param consoleLevel - Threshold for the console logger. Defaults to `debug`
 *                       so every event-bus entry is also printed; raise this
 *                       for noisy levels if needed.
 */
export class EventBusLogger implements ILogger {
  private sink: IDebugEventSink<any> | undefined
  private readonly consoleLogger: ILogger

  readonly fatal: LogFn
  readonly error: LogFn
  readonly warn: LogFn
  readonly info: LogFn
  readonly debug: LogFn
  readonly trace: LogFn
  // pino.silent() = no-op method, regardless of logger level
  readonly silent: LogFn = () => {}

  constructor(sink?: IDebugEventSink<any>, consoleLevel: Level = 'debug') {
    this.sink = sink
    this.consoleLogger = createConsoleLogger({ level: consoleLevel })

    this.fatal = this.makeMethod('fatal', this.consoleLogger.fatal)
    this.error = this.makeMethod('error', this.consoleLogger.error)
    this.warn = this.makeMethod('warn', this.consoleLogger.warn)
    this.info = this.makeMethod('info', this.consoleLogger.info)
    this.debug = this.makeMethod('debug', this.consoleLogger.debug)
    this.trace = this.makeMethod('trace', this.consoleLogger.trace)
  }

  /**
   * Swap the sink this logger emits to. Pass `undefined` to detach —
   * subsequent log calls will still reach the console but won't attempt
   * emission. Intended for per-test setup where each test spins up a fresh
   * sink; app code should pass the sink to the constructor instead.
   */
  setSink(sink: IDebugEventSink<any> | undefined): void {
    this.sink = sink
  }

  private makeMethod(methodLevel: Exclude<Level, 'silent'>, consoleFn: LogFn): LogFn {
    // Cast to the widest pino-compatible shape so the variadic forward below
    // type-checks — the overloads on LogFn make a direct spread ambiguous.
    const forward = consoleFn as (...args: any[]) => void
    const fn = (...args: any[]) => {
      if (args.length === 0) return
      const sink = this.sink
      if (sink !== undefined) {
        try {
          emitDebugLogEvent(sink, methodLevel, args)
        } catch {
          // Sink has been completed (e.g. previous test's bus that outlived
          // its owner). Drop the emission; console path still runs below.
        }
      }
      forward(...args)
    }
    return fn as LogFn
  }
}

function emitDebugLogEvent(
  sink: IDebugEventSink<any>,
  methodLevel: Exclude<Level, 'silent'>,
  args: any[],
): void {
  let data: Record<string, any>
  const [first, second] = args

  if (typeof first === 'object' && first !== null) {
    data = { ...first }
  } else if (typeof second === 'object' && second !== null) {
    data = { ...second }
  } else {
    data = {}
  }

  if (typeof first === 'string') {
    // log("msg", ...)
    data.message = first
  } else if (typeof second === 'string') {
    // log(obj, "msg"?, ...)
    data.message = second
  }

  data.level = methodLevel
  if ('err' in data) {
    data.err = serializeErr(data.err)
  }
  sink.emitDebug('debug:log', data)
}

function serializeErr(err: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (err === null || err === undefined) return err
  if (typeof err !== 'object') return err

  if (seen.has(err)) return '[Circular]'
  seen.add(err)

  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      type: err.constructor.name,
      message: err.message,
      stack: err.stack,
    }
    for (const key of Object.getOwnPropertyNames(err)) {
      if (key === 'message' || key === 'stack' || key === 'cause') continue
      out[key] = serializeValue((err as unknown as Record<string, unknown>)[key], seen)
    }
    if ('cause' in err && err.cause !== undefined) {
      out.cause = serializeErr(err.cause, seen)
    }
    return out
  }

  const out: Record<string, unknown> = {}
  for (const key of Object.getOwnPropertyNames(err)) {
    out[key] = serializeValue((err as Record<string, unknown>)[key], seen)
  }
  return out
}

function serializeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return value
  if (t === 'bigint') return value.toString()
  if (t === 'function' || t === 'symbol') return undefined
  if (value instanceof Error) return serializeErr(value, seen)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
    if (Array.isArray(value)) return value.map((v) => serializeValue(v, seen))
    const out: Record<string, unknown> = {}
    for (const key of Object.getOwnPropertyNames(value)) {
      out[key] = serializeValue((value as Record<string, unknown>)[key], seen)
    }
    return out
  }
  return undefined
}
