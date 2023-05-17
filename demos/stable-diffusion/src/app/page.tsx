"use client"

import { RemoteProvider, useRemoteMutable, useRemoteObject, useRemoteValue } from "@/lib/remote"
import { useCallback, useEffect } from "react"

function Button(props: { text: string, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      disabled={props.disabled}
      className="inline-block px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white disabled:bg-gray-300 bg-indigo-600 hover:bg-indigo-700"
      onClick={props.onClick}
    >{props.text}</button>
  )
}

type WeightedPrompt = { prompt: string, weight: number }

function WeightedPromptEntry(props: { value: WeightedPrompt, onChange: (v: WeightedPrompt) => void }) {
  const { value, onChange } = props
  return (
    <>
      <input type="text" value={value.prompt} onChange={(t) => onChange({ ...value, prompt: t.target.value })}
        className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
      />
      <input type="range" min={0} max={1} step={0.001} value={value.weight} onChange={(t) => onChange({ ...value, weight: Number(t.target.value) })} />
    </>
  )
}

function useWebMidi(callback: (slider: number, value: number) => void) {
  useEffect(() => {
    const toCleanUp: Array<WebMidi.MIDIInput> = []

    const onMIDISuccess = (midiAccess: WebMidi.MIDIAccess) => {
      for (const input of midiAccess.inputs.values()) {
        input.onmidimessage = onMessage;
        toCleanUp.push(input)
      }
    }

    const onMessage = (e: WebMidi.MIDIMessageEvent) => {
      const [_, slider, value] = e.data;
      callback(slider, value)
    }

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, undefined);
    }

    return () => {
      for (const input of toCleanUp) {
        input.onmidimessage = null as any
      }
    }
  }, [callback])
}

function StableDiffusionUI() {
  const sdApp = useRemoteObject("stable-diffusion")
  const imageData = useRemoteValue(sdApp?.result)
  const [prompts, setPrompts] = useRemoteMutable(sdApp?.prompts)
  const progress = useRemoteValue(sdApp?.progress)

  let url = null
  if (imageData) {
    const blob = new Blob([imageData], { type: 'image/jpeg' });
    url = URL.createObjectURL(blob);
  }

  const midiCallback = useCallback((slider: number, value: number) => {
    if (!sdApp) {
      return
    }

    const prompts = sdApp.prompts.get()
    const newPrompts = [...prompts]
    newPrompts[slider] = { ...newPrompts[slider], weight: value / 127 }
    setPrompts(newPrompts)
  }, [sdApp])

  useWebMidi(midiCallback)

  return (
    <div className="flex flex-col space-y-3">
      <Button onClick={() => sdApp?.shuffle_latents.send()} text="Shuffle latents" />

      <div>
        <div style={{ width: `${progress * 100}%`, transition: "width 200ms, opacity 500ms", opacity: (progress === 1 ? 0 : 1) }} className="h-1 bg-indigo-600 rounded-full"></div>
      </div>

      <div className="w-[768px] h-[768px] bg-black">
        {url ? <img src={url} /> : null}
      </div>

      {
        prompts?.map((p: WeightedPrompt, i: number) => <div key={i} className="flex flex-row space-x-3"><WeightedPromptEntry value={p} onChange={(v) => {
          const newPrompts = [...prompts]
          newPrompts[i] = v
          setPrompts(newPrompts)
        }} />

          <Button text="-" onClick={
            () => {
              const newPrompts = [...prompts]
              newPrompts.splice(i, 1)
              setPrompts(newPrompts)
            }
          } />
        </div>)
      }

      <Button
        text="+"
        disabled={prompts === undefined}
        onClick={() => {
          const newPrompts = [...prompts]
          newPrompts.push({ prompt: "", weight: 1.0 })
          setPrompts(newPrompts)
        }} />
    </div>
  )
}

export default function Home() {
  return (
    <RemoteProvider endpoint="ws://localhost:8080/">
      <StableDiffusionUI />
    </RemoteProvider>
  )
}