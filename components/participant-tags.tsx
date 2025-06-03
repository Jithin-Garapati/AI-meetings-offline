"use client"

import { useState, useRef, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface ParticipantTagsProps {
  participants: string[]
  setParticipants: (participants: string[]) => void
  disabled?: boolean
}

export function ParticipantTags({ participants, setParticipants, disabled = false }: ParticipantTagsProps) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault()
      addParticipant(inputValue.trim())
    } else if (e.key === "Backspace" && !inputValue && participants.length > 0) {
      removeParticipant(participants.length - 1)
    }
  }

  const addParticipant = (name: string) => {
    if (name && !participants.includes(name)) {
      setParticipants([...participants, name])
      setInputValue("")
    }
  }

  const removeParticipant = (index: number) => {
    const newParticipants = [...participants]
    newParticipants.splice(index, 1)
    setParticipants(newParticipants)
  }

  const handleInputBlur = () => {
    if (inputValue.trim()) {
      addParticipant(inputValue.trim())
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-white"
      onClick={() => inputRef.current?.focus()}
    >
      {participants.map((participant, index) => (
        <Badge key={index} variant="secondary" className="px-2 py-1 text-sm">
          {participant}
          {!disabled && (
            <button
              type="button"
              className="ml-1 text-gray-500 hover:text-gray-700"
              onClick={() => removeParticipant(index)}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && (
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          className="flex-1 min-w-[100px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-7"
          placeholder={participants.length === 0 ? "Add participants (press Enter after each name)" : ""}
        />
      )}
    </div>
  )
}
