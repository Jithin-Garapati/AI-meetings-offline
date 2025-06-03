"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Mic,
  Download,
  Trash2,
  Save,
  Copy,
  Settings,
  FileText,
  Calendar,
  Loader2,
  Upload,
  AlertTriangle,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ParticipantTags } from "@/components/participant-tags"
import { loadWhisperModel, transcribeBlob } from "@/lib/whisper"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface Transcription {
  id: string
  text: string
  timestamp: Date
  participants: string[]
  markdownSummary?: string // Consolidated field for the AI-generated summary in Markdown format
}


export default function TranscriptionApp() {
  const [isRecording, setIsRecording] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [isSupported, setIsSupported] = useState(true)
  const [error, setError] = useState("")
  const [language, setLanguage] = useState("en-US")
  const [autoSave, setAutoSave] = useState(true)
  const [currentParticipants, setCurrentParticipants] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("transcription")
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [selectedTranscription, setSelectedTranscription] = useState<Transcription | null>(null)
  const [storageStatus, setStorageStatus] = useState<"available" | "unavailable" | "checking">("checking")
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [isWhisperLoading, setIsWhisperLoading] = useState(true)
  const [whisperReady, setWhisperReady] = useState(false)
  const [modelSize, setModelSize] = useState<'base' | 'small'>('base')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Group transcriptions by date
  const groupedTranscriptions = transcriptions.reduce((groups: Record<string, Transcription[]>, item) => {
    const date = new Date(item.timestamp).toLocaleDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(item)
    return groups
  }, {})

  // Check if localStorage is available
  useEffect(() => {
    try {
      localStorage.setItem("storage-test", "test")
      localStorage.removeItem("storage-test")
      setStorageStatus("available")
    } catch (e) {
      setStorageStatus("unavailable")
      setError("Local storage is not available. Your transcriptions will not be saved between sessions.")
    }
  }, [])

  // Load transcriptions from localStorage on mount
  useEffect(() => {
    if (storageStatus === "available") {
      try {
        const saved = localStorage.getItem("transcriptions")
        if (saved) {
          const parsed = JSON.parse(saved).map((t: any) => ({
            ...t,
            timestamp: new Date(t.timestamp),
          }))
          setTranscriptions(parsed)
        }
      } catch (e) {
        console.error("Failed to load transcriptions:", e)
        setError("Failed to load saved transcriptions. Your previous data might be corrupted.")
      }
    }

    // Check if MediaRecorder is supported for Whisper recording
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setIsSupported(false)
      setError("Audio recording is not supported in this browser.")
    }
  }, [storageStatus])

  // Load Whisper model on mount so it can be cached for offline use
  useEffect(() => {
    setIsWhisperLoading(true)
    setWhisperReady(false)
    loadWhisperModel(modelSize)

    loadWhisperModel()
      .then(() => {
        setWhisperReady(true)
      })
      .catch((err) => {
        console.error('Failed to load Whisper model', err)
        if (!navigator.onLine) {
          setError('Whisper model not available offline. Please connect to the internet to download it.')
        } else {
          setError('Failed to load speech recognition model.')
        }
      })
      .finally(() => {
        setIsWhisperLoading(false)
      })
  }, [modelSize])

  }, [])

  // Save transcriptions to localStorage whenever they change
  useEffect(() => {
    if (storageStatus === "available" && transcriptions.length > 0) {
      try {
        localStorage.setItem("transcriptions", JSON.stringify(transcriptions))
      } catch (e) {
        console.error("Failed to save transcriptions:", e)
        setError("Failed to save transcriptions to local storage. You might be running out of storage space.")
      }
    }
  }, [transcriptions, storageStatus])

  const startRecording = async () => {
    if (!isSupported) return

    if (!whisperReady) {
      if (!navigator.onLine) {
        setError('Speech recognition model not available offline yet. Connect to the internet to download it.')
      } else if (isWhisperLoading) {
        setError('Speech recognition model is still loading, please wait.')
      } else {
        setError('Speech recognition model is not ready.')
      }
      return
    }

    try {
      await loadWhisperModel(modelSize)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)

      recorder.onstart = () => {
        setIsRecording(true)
        setError("")
      }

      recorder.ondataavailable = async (e: BlobEvent) => {
        if (e.data.size > 0) {
          try {
            const text = await transcribeBlob(e.data, modelSize)
            setCurrentTranscript((prev) => prev + text + " ")
          } catch (err) {
            console.error(err)
            setError("Failed to transcribe audio chunk")
          }
        }
      }

      recorder.onstop = () => {
        setIsRecording(false)
        if (autoSave && currentTranscript.trim()) {
          saveCurrentTranscription()
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(2000)
    } catch (err) {
      setError("Failed to start recording")
      console.error(err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }

  const saveCurrentTranscription = () => {
    if (!currentTranscript.trim()) return

    const newTranscription: Transcription = {
      id: Date.now().toString(),
      text: currentTranscript.trim(),
      timestamp: new Date(),
      participants: currentParticipants,
    }

    setTranscriptions((prev) => [newTranscription, ...prev])
    setCurrentTranscript("")

    // Keep participants for next session
    toast({
      title: "Meeting saved",
      description: `Transcription saved with ${currentParticipants.length} participants`,
    })
  }

  const deleteTranscription = (id: string) => {
    setTranscriptions((prev) => prev.filter((t) => t.id !== id))
  }

  const clearAll = () => {
    if (window.confirm("Are you sure you want to delete all transcriptions? This cannot be undone.")) {
      setTranscriptions([])
      if (storageStatus === "available") {
        localStorage.removeItem("transcriptions")
      }
    }
  }

  const exportTranscriptions = () => {
    const data = transcriptions.map((t) => ({
      ...t,
      timestamp: t.timestamp.toISOString(),
    }))

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `meeting-transcriptions-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Export successful",
      description: "Your transcriptions have been exported to a JSON file",
    })
  }

  const importTranscriptions = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importedData = JSON.parse(content)

        if (!Array.isArray(importedData)) {
          throw new Error("Invalid format: Expected an array")
        }

        const validatedData = importedData.map((item) => {
          if (!item.id || !item.text || !item.timestamp) {
            throw new Error("Invalid format: Missing required fields")
          }

          return {
            ...item,
            timestamp: new Date(item.timestamp),
            participants: Array.isArray(item.participants) ? item.participants : [],
          }
        })

        setTranscriptions((prev) => {
          // Merge with existing transcriptions, avoiding duplicates
          const existingIds = new Set(prev.map((t) => t.id))
          const newItems = validatedData.filter((item) => !existingIds.has(item.id))
          return [...newItems, ...prev]
        })

        setImportDialogOpen(false)
        toast({
          title: "Import successful",
          description: `Imported ${validatedData.length} transcriptions`,
        })
      } catch (err) {
        console.error("Failed to import transcriptions:", err)
        toast({
          title: "Import failed",
          description: "The file format is invalid. Please select a valid export file.",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const copyToClipboard = (text: string, type?: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: type ? `${type} has been copied to your clipboard` : "Text has been copied to your clipboard",
    })
  }

  const generateMeetingSummary = async (transcription: Transcription) => {
    setIsGeneratingSummary(true)
    setSelectedTranscription(transcription)

    try {
      const response = await fetch("/api/generate-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcription.text,
          participants: transcription.participants,
        }),
      })

      if (!response.ok) {
        let errorDetail = `Failed to generate summary. HTTP Status: ${response.status}`;
        try {
          const errorData = await response.json(); // Attempt to parse error response as JSON
          errorDetail = errorData.details || errorData.error || errorDetail;
        } catch (e) {
          // If response is not JSON or another error occurs, try to get text
          const textError = await response.text().catch(() => "Could not retrieve error details.");
          errorDetail = textError || errorDetail;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();

      if (data.markdownSummary) {
        const updatedTranscriptions = transcriptions.map((t) => {
          if (t.id === transcription.id) {
            const updatedTranscription = {
              ...t,
              markdownSummary: data.markdownSummary,
            };
            // Clean up old properties if they somehow still exist on the object
            delete (updatedTranscription as any).summary;
            delete (updatedTranscription as any).keyPoints;
            delete (updatedTranscription as any).actionItems;
            return updatedTranscription;
          }
          return t;
        });
        setTranscriptions(updatedTranscriptions);

        // Ensure selectedTranscription (if it's the one being summarized) also gets the new summary and structure
        if (selectedTranscription && selectedTranscription.id === transcription.id) {
          setSelectedTranscription(prev => {
            if (!prev) return null;
            const updatedSelected = {
              ...prev,
              markdownSummary: data.markdownSummary,
            };
            delete (updatedSelected as any).summary;
            delete (updatedSelected as any).keyPoints;
            delete (updatedSelected as any).actionItems;
            return updatedSelected;
          });
        }

        toast({
          title: "Summary generated",
          description: "AI meeting summary has been created successfully",
        });
      } else if (data.error) {
        throw new Error(data.details || data.error || "Summary data is missing or an error occurred in API response");
      } else {
        throw new Error("Received an unexpected response structure from the summary API.");
      }

    } catch (err) {
      console.error("Error generating summary:", err)
      setError("Failed to generate meeting summary. Please try again.")
      toast({
        title: "Summary generation failed",
        description: "There was an error generating the meeting summary",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const languages = [
    { code: "en-US", name: "English (US)" },
    { code: "en-GB", name: "English (UK)" },
    { code: "es-ES", name: "Spanish" },
    { code: "fr-FR", name: "French" },
    { code: "de-DE", name: "German" },
    { code: "it-IT", name: "Italian" },
    { code: "pt-BR", name: "Portuguese (Brazil)" },
    { code: "ja-JP", name: "Japanese" },
    { code: "ko-KR", name: "Korean" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
  ]

  if (isWhisperLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="mt-4 text-gray-600">Downloading {modelSize} speech recognition model...</p>
        <p className="mt-4 text-gray-600">Downloading speech recognition model...</p>
      </div>
    )
  }

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <Alert className="mt-8">
            <AlertDescription>
              Audio recording is not supported in this browser.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Meeting Transcription & Notes</h1>
          <p className="text-gray-600">Offline speech-to-text with AI-powered meeting summaries</p>
          <div className="flex justify-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              🔒 Completely Private & Offline
            </Badge>
            {storageStatus === "unavailable" && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                <AlertTriangle className="w-3 h-3 mr-1" /> Storage Unavailable
              </Badge>
            )}
          </div>
        </div>

        {/* Storage Warning */}
        {storageStatus === "unavailable" && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-yellow-800">
              Local storage is not available. Your transcriptions will not be saved between sessions. Please export your
              data regularly.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger value="transcription">Record Meeting</TabsTrigger>
            <TabsTrigger value="history">Meeting History</TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="space-y-4 mt-4">
            {/* Settings */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Settings</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Transcription Settings</DialogTitle>
                        <DialogDescription>Configure your transcription preferences</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="language">Language</Label>
                          <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {languages.map((lang) => (
                                <SelectItem key={lang.code} value={lang.code}>
                                  {lang.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="model-size">Model Size</Label>
                          <Select value={modelSize} onValueChange={(v) => setModelSize(v as 'base' | 'small')}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="base">Base</SelectItem>
                              <SelectItem value="small">Small</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
                          <Label htmlFor="auto-save">Auto-save transcriptions</Label>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
            </Card>

            {/* Recording Interface */}
            <Card>
              <CardHeader>
                <CardTitle>Current Meeting</CardTitle>
                <CardDescription>
                  {isRecording ? "Recording... Speak now!" : "Click the microphone to start recording"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Participants Input */}
                <div>
                  <Label htmlFor="participants" className="mb-2 block">
                    Meeting Participants
                  </Label>
                  <ParticipantTags
                    participants={currentParticipants}
                    setParticipants={setCurrentParticipants}
                    disabled={isRecording}
                  />
                </div>

                {/* Recording Controls */}
                <div className="flex justify-center py-8">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`relative w-20 h-20 rounded-full border-4 transition-all duration-200 ${
                      isRecording
                        ? "border-red-400 bg-red-50 hover:bg-red-100"
                        : "border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50"
                    }`}
                    disabled={isWhisperLoading || !whisperReady}
                  >
                    <div className="w-full h-full rounded-full flex items-center justify-center">
                      {isRecording ? (
                        <div className="w-6 h-6 bg-red-500 rounded-sm" />
                      ) : (
                        <Mic className="w-8 h-8 text-gray-600" />
                      )}
                    </div>
                    {isRecording && (
                      <div className="absolute -inset-2 border-2 border-red-300 rounded-full" />
                    )}
                  </button>
                </div>

                {/* Live Transcript */}
                <div className="space-y-2">
                  <Label>Live Transcript</Label>
                  <Textarea
                    value={currentTranscript}
                    onChange={(e) => setCurrentTranscript(e.target.value)}
                    placeholder="Your transcription will appear here..."
                    className="min-h-[200px] resize-none"
                    readOnly={isRecording}
                  />
                </div>

                {/* Save Button */}
                <div className="flex gap-2">
                  <Button onClick={saveCurrentTranscription} className="flex-1" disabled={!currentTranscript.trim()}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Meeting
                  </Button>
                  {currentTranscript.trim() && (
                    <Button variant="outline" onClick={() => copyToClipboard(currentTranscript)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            {/* Saved Transcriptions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Meeting History</CardTitle>
                    <CardDescription>
                      {transcriptions.length} meeting{transcriptions.length !== 1 ? "s" : ""} stored locally
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {transcriptions.length > 0 && (
                      <>
                        <Button variant="outline" onClick={exportTranscriptions}>
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline">
                              <Upload className="w-4 h-4 mr-2" />
                              Import
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Import Transcriptions</DialogTitle>
                              <DialogDescription>
                                Upload a previously exported transcription file to restore your data
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="transcription-file">Transcription File</Label>
                                <input
                                  ref={fileInputRef}
                                  id="transcription-file"
                                  type="file"
                                  accept=".json"
                                  onChange={importTranscriptions}
                                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                              </div>
                              <p className="text-sm text-gray-500">
                                Note: This will merge the imported transcriptions with your existing ones.
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" onClick={clearAll}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear All
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {transcriptions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No meetings saved yet. Start recording to create your first meeting transcription!
                  </p>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedTranscriptions).map(([date, items]) => (
                      <div key={date} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <h3 className="font-medium text-gray-700">{date}</h3>
                          <Separator className="flex-1" />
                        </div>
                        <div className="space-y-4">
                          {items.map((transcription) => (
                            <Card key={transcription.id} className="border-l-4 border-l-blue-500">
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <CardTitle className="text-lg">
                                      Meeting with {transcription.participants.length} participants
                                    </CardTitle>
                                    {transcription.participants.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {transcription.participants.map((participant, i) => (
                                          <Badge key={i} variant="outline" className="text-xs">
                                            {participant}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                      {new Date(transcription.timestamp).toLocaleTimeString()}
                                    </Badge>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteTranscription(transcription.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <Tabs defaultValue="transcript" className="w-full">
                                  <TabsList className="grid grid-cols-2 w-full">
                                    <TabsTrigger value="transcript">Transcript</TabsTrigger>
                                    <TabsTrigger value="summary">AI Summary</TabsTrigger>
                                  </TabsList>
                                  <TabsContent value="transcript" className="mt-4">
                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-medium text-gray-700">Transcript</h4>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => copyToClipboard(transcription.text, "Transcript")}
                                        >
                                          <Copy className="w-4 h-4 mr-1" />
                                          Copy Transcript
                                        </Button>
                                      </div>
                                      <ScrollArea className="h-[200px] border rounded-md p-3 bg-gray-50">
                                        <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                                          {transcription.text}
                                        </p>
                                      </ScrollArea>
                                    </div>
                                  </TabsContent>
                                  <TabsContent value="summary" className="mt-4">
                                    {transcription.markdownSummary ? (
                                      <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                          <h4 className="text-sm font-medium text-gray-700">AI Summary</h4>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              if (transcription.markdownSummary) {
                                                copyToClipboard(transcription.markdownSummary, "AI Summary (Markdown)");
                                              }
                                            }}
                                            disabled={!transcription.markdownSummary}
                                          >
                                            <Copy className="w-4 h-4 mr-1" />
                                            Copy Summary
                                          </Button>
                                        </div>
                                        <ScrollArea className="h-[300px] border rounded-md p-3 bg-gray-50">
                                          <div className="markdown">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                              {transcription.markdownSummary}
                                            </ReactMarkdown>
                                          </div>
                                        </ScrollArea>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                        {isGeneratingSummary && selectedTranscription?.id === transcription.id ? (
                                          <div className="flex flex-col items-center space-y-4">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                            <p className="text-gray-500">Generating AI summary...</p>
                                          </div>
                                        ) : (
                                          <>
                                            <FileText className="w-12 h-12 text-gray-300" />
                                            <p className="text-gray-500">No summary generated yet for this meeting.</p>
                                            <Button
                                              onClick={() => generateMeetingSummary(transcription)}
                                              disabled={isGeneratingSummary}
                                            >
                                              Finish Meeting & Generate Summary
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </TabsContent>
                                </Tabs>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-center border-t pt-4">
                <p className="text-sm text-gray-500">
                  {storageStatus === "available"
                    ? "All transcriptions are stored in your browser's local storage"
                    : "Local storage is unavailable - please export your data regularly"}
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>
            All transcriptions are stored locally in your browser. No data is sent to any server except when generating
            AI summaries.
          </p>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
