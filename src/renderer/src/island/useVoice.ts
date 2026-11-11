import { useCallback, useEffect, useRef, useState } from 'react'
import { Model, type KaldiRecognizer } from 'vosk-browser'
import type { IslandEvent } from './islandMachine'
import type { IslandModuleEvent } from '../../../shared/moduleEvents'
import chimeUrl from '../../../../assets/sounds/chime.wav'

interface VoiceState {
  status: 'idle' | 'loading' | 'listening'
  transcript: string
  micLevel: number
  capturing: boolean
  wakeWordActive: boolean
}

const MODEL_URL = 'vosk-model-small-en-in-0.4.tar.gz'
const SAMPLE_RATE = 16_000
const SILENCE_DURATION = 6_000
const MODEL_LOAD_TIMEOUT = 120_000
const WAKE_WORD_DEBOUNCE = 2_000
const WAKE_WORD_GRAMMAR = JSON.stringify(['hey mino', 'hey island', '[unk]'])
const WORKLET_SOURCE = `
class MinoVoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(2048);
    this.offset = 0;
    this.sumSquares = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input) {
      for (let i = 0; i < input.length; i++) {
        const sample = input[i];
        this.samples[this.offset++] = sample;
        this.sumSquares += sample * sample;
        if (this.offset === this.samples.length) {
          const audio = this.samples;
          this.port.postMessage({
            audio,
            level: Math.sqrt(this.sumSquares / this.samples.length)
          }, [audio.buffer]);
          this.samples = new Float32Array(2048);
          this.offset = 0;
          this.sumSquares = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('mino-voice-capture', MinoVoiceCapture);
`

function loadVoskModel(modelUrl: string): Promise<Model> {
  const model = new Model(modelUrl, -1)
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      model.terminate()
      reject(new Error('Speech model loading timed out'))
    }, MODEL_LOAD_TIMEOUT)
    const fail = (error: Error): void => {
      window.clearTimeout(timeout)
      model.terminate()
      reject(error)
    }

    model.on('load', (message) => {
      if (message.event !== 'load') return
      window.clearTimeout(timeout)
      if (message.result) resolve(model)
      else fail(new Error('Speech model could not be loaded'))
    })
    model.on('error', (message) => {
      if (message.event === 'error') fail(new Error(message.error))
    })
  })
}

function containsWakeWord(text: string): boolean {
  return /(?:^|\s)hey\s+(?:mino|island)(?:$|\s)/i.test(text.trim())
}

export function useVoice(send: (event: IslandEvent) => void): VoiceState & {
  start: () => void
} {
  const [voice, setVoice] = useState<VoiceState>({
    status: 'idle',
    transcript: '',
    micLevel: 0,
    capturing: false,
    wakeWordActive: false
  })
  const modelRef = useRef<Model | null>(null)
  const modelPromiseRef = useRef<Promise<Model> | null>(null)
  const wakeRecognizerRef = useRef<KaldiRecognizer | null>(null)
  const commandRecognizerRef = useRef<KaldiRecognizer | null>(null)
  const modeRef = useRef<'off' | 'wake' | 'command-pending' | 'command'>('off')
  const listeningRef = useRef(false)
  const wakeWordEnabledRef = useRef(false)
  const microphoneEnabledRef = useRef(false)
  const aliveRef = useRef(true)
  const lastWakeAtRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const partialRef = useRef('')
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const silenceCheckRef = useRef<number | null>(null)
  const finalResultTimerRef = useRef<number | null>(null)
  const pipelinePromiseRef = useRef<Promise<void> | null>(null)
  const startRef = useRef<() => void>(() => {})
  const finishRef = useRef<(text: string) => void>(() => {})
  const failRef = useRef<(error: unknown) => void>(() => {})

  const clearCommandTimers = useCallback((): void => {
    if (silenceCheckRef.current !== null) {
      window.clearInterval(silenceCheckRef.current)
      silenceCheckRef.current = null
    }
    if (finalResultTimerRef.current !== null) {
      window.clearTimeout(finalResultTimerRef.current)
      finalResultTimerRef.current = null
    }
  }, [])

  const removeRecognizers = useCallback((): void => {
    wakeRecognizerRef.current?.remove()
    commandRecognizerRef.current?.remove()
    wakeRecognizerRef.current = null
    commandRecognizerRef.current = null
    modeRef.current = 'off'
  }, [])

  const stopCapture = useCallback((): void => {
    listeningRef.current = false
    clearCommandTimers()
    removeRecognizers()
    workletRef.current?.port.close()
    workletRef.current?.disconnect()
    sourceRef.current?.disconnect()
    gainRef.current?.disconnect()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    const context = audioContextRef.current
    if (context && context.state !== 'closed') void context.close()
    workletRef.current = null
    sourceRef.current = null
    gainRef.current = null
    streamRef.current = null
    audioContextRef.current = null
    if (aliveRef.current) {
      setVoice((current) => ({
        ...current,
        capturing: false,
        wakeWordActive: false,
        micLevel: 0
      }))
    }
  }, [clearCommandTimers, removeRecognizers])

  const runCommand = useCallback(
    async (transcript: string): Promise<void> => {
      try {
        const result = await window.island.voice.runCommand(transcript.trim())
        send({
          type: 'ALERT',
          payload: {
            title: result.title,
            message: result.message,
            type: result.type
          }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send({ type: 'ALERT', payload: { title: 'Voice command failed', message, type: 'error' } })
      }
    },
    [send]
  )

  const createWakeRecognizer = useCallback((): void => {
    const model = modelRef.current
    const audioContext = audioContextRef.current
    if (!model || !audioContext || !wakeWordEnabledRef.current) return

    removeRecognizers()
    const recognizer = new model.KaldiRecognizer(audioContext.sampleRate, WAKE_WORD_GRAMMAR)
    wakeRecognizerRef.current = recognizer
    modeRef.current = 'wake'
    const onText = (text: string): void => {
      if (
        !containsWakeWord(text) ||
        listeningRef.current ||
        Date.now() - lastWakeAtRef.current < WAKE_WORD_DEBOUNCE
      ) {
        return
      }
      lastWakeAtRef.current = Date.now()
      const ding = new Audio(chimeUrl)
      void ding.play().catch((error: unknown) => {
        console.error('[voice] Could not play wake-word sound', error)
      })
      startRef.current()
    }

    recognizer.on('partialresult', (message) => {
      if (message.event === 'partialresult') onText(message.result.partial)
    })
    recognizer.on('result', (message) => {
      if (message.event === 'result') onText(message.result.text)
    })
    recognizer.on('error', (message) => {
      if (message.event === 'error') failRef.current(new Error(message.error))
    })
    setVoice((current) => ({ ...current, wakeWordActive: true }))
  }, [removeRecognizers])

  const activateCommandRecognizer = useCallback((): void => {
    const model = modelRef.current
    const audioContext = audioContextRef.current
    if (!model || !audioContext || !listeningRef.current) return

    removeRecognizers()
    const recognizer = new model.KaldiRecognizer(audioContext.sampleRate)
    commandRecognizerRef.current = recognizer
    modeRef.current = 'command'
    partialRef.current = ''
    lastVoiceAtRef.current = Date.now()
    recognizer.on('partialresult', (message) => {
      if (message.event !== 'partialresult' || !listeningRef.current) return
      partialRef.current = message.result.partial
      setVoice((current) => ({ ...current, transcript: partialRef.current }))
    })
    recognizer.on('result', (message) => {
      if (message.event !== 'result' || !listeningRef.current) return
      const text = message.result.text.trim()
      if (text) finishRef.current(text)
    })
    recognizer.on('error', (message) => {
      if (message.event === 'error') failRef.current(new Error(message.error))
    })
    silenceCheckRef.current = window.setInterval(() => {
      if (Date.now() - lastVoiceAtRef.current < SILENCE_DURATION) return
      const activeRecognizer = commandRecognizerRef.current
      if (!activeRecognizer) return
      clearCommandTimers()
      activeRecognizer.retrieveFinalResult()
      finalResultTimerRef.current = window.setTimeout(() => {
        finishRef.current(partialRef.current)
      }, 900)
    }, 250)
  }, [clearCommandTimers, removeRecognizers])

  const ensureCapture = useCallback(async (): Promise<void> => {
    const existingContext = audioContextRef.current
    if (
      existingContext &&
      existingContext.state !== 'closed' &&
      workletRef.current &&
      streamRef.current
    ) {
      return
    }
    if (pipelinePromiseRef.current) return pipelinePromiseRef.current

    const setup = (async (): Promise<void> => {
      if (!modelRef.current) {
        if (!modelPromiseRef.current) {
          const available = await window.island.voice.isModelAvailable()
          if (!available) {
            throw new Error(
              import.meta.env.PROD
                ? 'The bundled Vosk model is missing. Reinstall Mino.'
                : `Vosk model not found. Check assets/models/runtime/${MODEL_URL}.`
            )
          }
          const modelData = await window.island.voice.getModelData()
          const modelArchive = new Uint8Array(modelData)
          const modelUrl = URL.createObjectURL(
            new Blob([modelArchive.buffer], { type: 'application/gzip' })
          )
          modelPromiseRef.current = loadVoskModel(modelUrl).finally(() =>
            URL.revokeObjectURL(modelUrl)
          )
        }
        try {
          const model = await modelPromiseRef.current
          modelPromiseRef.current = null
          if (!aliveRef.current) {
            model.terminate()
            return
          }
          modelRef.current = model
        } catch (error) {
          modelPromiseRef.current = null
          throw error
        }
      }
      if (!aliveRef.current) return

      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      if (!aliveRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }))
      try {
        await audioContext.audioWorklet.addModule(moduleUrl)
      } finally {
        URL.revokeObjectURL(moduleUrl)
      }
      if (!aliveRef.current) return

      const worklet = new AudioWorkletNode(audioContext, 'mino-voice-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1
      })
      worklet.port.onmessage = (event: MessageEvent<{ audio: Float32Array; level: number }>) => {
        if (!aliveRef.current) return
        const { audio, level } = event.data
        if (modeRef.current === 'wake') {
          try {
            wakeRecognizerRef.current?.acceptWaveformFloat(audio, audioContext.sampleRate)
          } catch (error) {
            failRef.current(error)
          }
          return
        }
        if (modeRef.current !== 'command' || !listeningRef.current) return

        setVoice((current) => ({
          ...current,
          status: 'listening',
          transcript: current.transcript === 'Loading voice…' ? '' : current.transcript,
          micLevel: level,
          capturing: true
        }))
        if (level > 0.012) lastVoiceAtRef.current = Date.now()
        try {
          commandRecognizerRef.current?.acceptWaveformFloat(audio, audioContext.sampleRate)
        } catch (error) {
          failRef.current(error)
        }
      }

      const gain = audioContext.createGain()
      gain.gain.value = 0
      source.connect(worklet)
      worklet.connect(gain)
      gain.connect(audioContext.destination)
      sourceRef.current = source
      workletRef.current = worklet
      gainRef.current = gain
      await audioContext.resume()
      if (!aliveRef.current) return

      if (wakeWordEnabledRef.current && !listeningRef.current) createWakeRecognizer()
      else modeRef.current = 'command-pending'
      setVoice((current) => ({
        ...current,
        wakeWordActive: wakeWordEnabledRef.current && !listeningRef.current
      }))
    })()

    pipelinePromiseRef.current = setup
    try {
      await setup
    } finally {
      if (pipelinePromiseRef.current === setup) pipelinePromiseRef.current = null
    }
  }, [createWakeRecognizer])

  const restoreWakeRecognizer = useCallback((): void => {
    if (wakeWordEnabledRef.current && audioContextRef.current) {
      try {
        createWakeRecognizer()
        return
      } catch (error) {
        console.error('[voice] Could not restart wake-word recognition', error)
      }
    }
    stopCapture()
  }, [createWakeRecognizer, stopCapture])

  const applyVoiceSettings = useCallback(
    (config: { wakeWordEnabled: boolean; microphoneEnabled: boolean }): void => {
      microphoneEnabledRef.current = config.microphoneEnabled
      wakeWordEnabledRef.current = config.wakeWordEnabled && config.microphoneEnabled
      if (!config.microphoneEnabled && listeningRef.current) {
        listeningRef.current = false
        clearCommandTimers()
        setVoice((current) => ({
          ...current,
          status: 'idle',
          transcript: '',
          micLevel: 0,
          capturing: false,
          wakeWordActive: false
        }))
        send({ type: 'LISTEN_END' })
      }
      if (!config.microphoneEnabled || (!config.wakeWordEnabled && !listeningRef.current)) {
        stopCapture()
        return
      }
      if (!listeningRef.current) {
        void ensureCapture().catch((error: unknown) => failRef.current(error))
      }
    },
    [clearCommandTimers, ensureCapture, send, stopCapture]
  )

  const finish = useCallback(
    (text: string): void => {
      if (!listeningRef.current) return
      listeningRef.current = false
      clearCommandTimers()
      commandRecognizerRef.current?.remove()
      commandRecognizerRef.current = null
      modeRef.current = 'off'
      setVoice((current) => ({
        ...current,
        status: 'idle',
        transcript: '',
        micLevel: 0,
        capturing: false
      }))
      send({ type: 'LISTEN_END' })
      restoreWakeRecognizer()
      void runCommand(text)
    },
    [clearCommandTimers, restoreWakeRecognizer, runCommand, send]
  )

  const fail = useCallback(
    (error: unknown): void => {
      const wasListening = listeningRef.current
      listeningRef.current = false
      stopCapture()
      setVoice((current) => ({
        ...current,
        status: 'idle',
        transcript: '',
        micLevel: 0,
        capturing: false,
        wakeWordActive: false
      }))
      if (wasListening) send({ type: 'LISTEN_END' })
      const message =
        error instanceof Error
          ? error.message
          : error
            ? String(error)
            : 'The speech model could not be loaded'
      window.island.voice.reportError(message)
      send({
        type: 'ALERT',
        payload: {
          title: 'Voice unavailable',
          message: `${message}. Check Windows microphone permissions. If it persists, see %APPDATA%\\dynamic-island\\logs\\mino.log.`,
          type: 'error'
        }
      })
    },
    [send, stopCapture]
  )

  const start = useCallback((): void => {
    if (listeningRef.current) return
    if (!microphoneEnabledRef.current) {
      send({
        type: 'ALERT',
        payload: {
          title: 'Microphone disabled',
          message: 'Enable the microphone from the Mino tray menu or settings.',
          type: 'warning'
        }
      })
      return
    }
    listeningRef.current = true
    modeRef.current = 'command-pending'
    setVoice((current) => ({
      ...current,
      status: 'loading',
      transcript: 'Loading voice…',
      micLevel: 0,
      capturing: Boolean(streamRef.current),
      wakeWordActive: false
    }))
    send({ type: 'LISTEN_START' })
    void ensureCapture()
      .then(() => {
        if (listeningRef.current) activateCommandRecognizer()
      })
      .catch((error: unknown) => failRef.current(error))
  }, [activateCommandRecognizer, ensureCapture, send])

  useEffect(() => {
    startRef.current = start
    finishRef.current = finish
    failRef.current = fail
  }, [fail, finish, start])

  useEffect(() => {
    aliveRef.current = true
    let active = true
    void window.island.voice
      .getConfig()
      .then((config) => {
        if (active) applyVoiceSettings(config)
      })
      .catch((error: unknown) => {
        if (active) failRef.current(error)
      })
    return () => {
      active = false
    }
  }, [applyVoiceSettings])

  useEffect(() => {
    const unsubscribe = window.island.onModuleEvent((event: IslandModuleEvent) => {
      if (event.type === 'voice.listen') start()
      if (event.type === 'settings.updated') applyVoiceSettings(event.payload.voice)
    })
    return unsubscribe
  }, [applyVoiceSettings, start])

  useEffect(
    () => () => {
      aliveRef.current = false
      stopCapture()
      modelRef.current?.terminate()
      modelRef.current = null
    },
    [stopCapture]
  )

  return { ...voice, start }
}
