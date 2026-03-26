import { useEffect, useState, useRef } from "react";
import { API_BASE } from "../lib/config";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { DashboardHeader } from "./DashboardHeader";
import {
  PhoneOff, Mic, MicOff, Camera, CameraOff,
  Mic2, FileText, Save, Plus, Trash2, CheckCircle2, Loader2,
} from "lucide-react";
import { motion } from "motion/react";

const API = API_BASE;
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

interface MedLine {
  id:           number;
  medication:   string;
  dosage:       string;
  instructions: string;
}

interface VideoConferenceDoctorProps {
  roomName?:      string;
  onEndCall:      () => void;
  onNavigateHome: () => void;
  onLogout:       () => void;
  patientId?:     number;
  patientName?:   string;
}

export function VideoConferenceDoctor({
  roomName,
  onEndCall,
  onNavigateHome,
  onLogout,
  patientId,
  patientName: propPatientName = "Patient",
}: VideoConferenceDoctorProps) {

  // ── PeerJS WebRTC state ──────────────────────────────────────────────────
  const peerRef        = useRef<any>(null);
  const callRef        = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  type PeerStatus = 'loading' | 'waiting' | 'connected' | 'error';
  const [peerStatus, setPeerStatus] = useState<PeerStatus>('loading');
  const [peerError,  setPeerError]  = useState("");

  // ── Call controls ────────────────────────────────────────────────────────
  const [isMuted,       setIsMuted]       = useState(false);
  const [isCameraOff,   setIsCameraOff]   = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);

  // ── Prescription dictation ───────────────────────────────────────────────
  const [language,       setLanguage]       = useState("english");
  const [isRecording,    setIsRecording]    = useState(false);
  const [dictationText,  setDictationText]  = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [extractError,   setExtractError]   = useState("");
  const [extractSuccess, setExtractSuccess] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);

  // ── Prescription form ────────────────────────────────────────────────────
  const [diagnosis,   setDiagnosis]   = useState("");
  const [medications, setMedications] = useState<MedLine[]>([
    { id: 1, medication: "", dosage: "", instructions: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved,    setSaved]    = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  /** Extract the numeric appointment ID from roomName like "mediscript-appt-123" */
  const getApptId = () => {
    const match = (roomName || "").match(/(\d+)$/);
    return match ? match[1] : "demo";
  };

  // ── PeerJS initialisation ────────────────────────────────────────────────
  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;

    const initializePeer = () => {
      const doctorPeerId = `ms-doc-${getApptId()}`;
      const peer = new (window as any).Peer(doctorPeerId);
      peerRef.current = peer;

      peer.on("open", () => {
        setPeerStatus("waiting");
        setPeerError("");
      });

      peer.on("error", (err: any) => {
        if (err.type === "unavailable-id") {
          // Previous session still live on the PeerJS broker — retry in 5 s
          peer.destroy();
          setPeerError("Reconnecting…");
          retryTimeout = setTimeout(initializePeer, 5000);
        } else {
          setPeerError(`Video error: ${err.type || err.message || "unknown"}`);
          setPeerStatus("error");
        }
      });

      peer.on("call", (call: any) => {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: true })
          .then((stream) => {
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            call.answer(stream);
            callRef.current = call;
            call.on("stream", (remoteStream: MediaStream) => {
              if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
              setPeerStatus("connected");
            });
            call.on("close", () => setPeerStatus("waiting"));
            call.on("error", () => setPeerStatus("waiting"));
          })
          .catch(() => {
            setPeerError("Camera/microphone access denied.");
            setPeerStatus("error");
          });
      });

      peer.on("disconnected", () => peer.reconnect());
    };

    const loadPeerJS = () => {
      if ((window as any).Peer) { initializePeer(); return; }
      const script = document.createElement("script");
      script.src   = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
      script.async = true;
      script.onload  = initializePeer;
      script.onerror = () => {
        setPeerError("Failed to load video library. Check your internet connection.");
        setPeerStatus("error");
      };
      document.body.appendChild(script);
    };

    loadPeerJS();

    return () => {
      clearTimeout(retryTimeout);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      callRef.current?.close();
      peerRef.current?.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Call controls ────────────────────────────────────────────────────────
  const handleEndCall = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    callRef.current?.close();
    peerRef.current?.destroy();
    if (isRecording) mediaRecorderRef.current?.stop();
    setShowPrescription(true);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const newMuted = !isMuted;
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
      setIsMuted(newMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const newOff = !isCameraOff;
      localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !newOff; });
      setIsCameraOff(newOff);
    }
  };

  // ── Voice dictation — MediaRecorder → Whisper + NER ─────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setExtractError("");
    setExtractSuccess("");
    setDictationText("");
    audioChunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setExtractError("Microphone access denied. Please allow microphone and try again.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      await sendAudioToWhisper(blob, mimeType);
    };
    recorder.start(250);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const sendAudioToWhisper = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setExtractError("");

    const form = new FormData();
    const ext  = mimeType.includes("webm") ? "webm" : "wav";
    form.append("audio", blob, `recording.${ext}`);

    try {
      const res  = await fetch(`${API}/prescriptions/from-audio`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body:    form,
      });
      const data = await res.json();

      if (!res.ok) {
        setExtractError("ML model not running — fill the prescription manually after ending the call.");
        setIsTranscribing(false);
        return;
      }

      setDictationText(data.transcript || "");

      if (!data.medicines?.length || !data.medicines[0].drug) {
        setExtractError("No medicines detected — fill the prescription manually after ending the call.");
      } else {
        const filled: MedLine[] = data.medicines.map((m: any, i: number) => ({
          id:           Date.now() + i,
          medication:   m.drug || "",
          dosage:       [m.dose, m.frequency].filter(Boolean).join(", "),
          instructions: [m.duration, m.route].filter(Boolean).join(", "),
        }));
        setMedications(filled);
        setExtractSuccess(`✅ ${filled.length} medicine(s) extracted — edit the form after ending the call.`);
      }
    } catch {
      setExtractError("ML model not running — fill the prescription manually after ending the call.");
    }

    setIsTranscribing(false);
  };

  // ── MedLine helpers ──────────────────────────────────────────────────────
  const addMed = () =>
    setMedications((prev) => [...prev, { id: Date.now(), medication: "", dosage: "", instructions: "" }]);

  const removeMed = (id: number) =>
    setMedications((prev) => prev.length > 1 ? prev.filter((m) => m.id !== id) : prev);

  const updateMed = (id: number, field: keyof MedLine, val: string) =>
    setMedications((prev) => prev.map((m) => m.id === id ? { ...m, [field]: val } : m));

  // ── Save prescription ────────────────────────────────────────────────────
  const savePrescription = async () => {
    const valid = medications.filter((m) => m.medication.trim());
    if (!valid.length) { alert("Please add at least one medication."); return; }

    setIsSaving(true);
    try {
      const results = await Promise.all(
        valid.map((m) =>
          fetch(`${API}/prescriptions`, {
            method:  "POST",
            headers: authHeader(),
            body:    JSON.stringify({
              patient_id:   patientId ?? 0,
              medication:   m.medication,
              dosage:       m.dosage,
              instructions: m.instructions,
            }),
          }).then((r) => r.json())
        )
      );
      if (results.every((r) => r.id)) {
        setSaved(true);
        setTimeout(onEndCall, 2000);
      } else {
        alert("Some prescriptions failed to save — please try again.");
      }
    } catch {
      alert("Could not connect to server.");
    }
    setIsSaving(false);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // POST-CALL PRESCRIPTION PANEL
  // ══════════════════════════════════════════════════════════════════════════
  if (showPrescription) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          title="Post-Consultation — Prescription"
          onNavigateHome={onNavigateHome}
          onLogout={onLogout}
          userType="doctor"
        />
        <div className="pt-16 p-6">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {saved ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-16 space-y-4"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Prescription Saved!</h3>
                  <p className="text-gray-500 text-sm">Redirecting…</p>
                </motion.div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <FileText className="w-5 h-5" />
                      Prescription for {propPatientName}
                      {extractSuccess && (
                        <span className="text-xs font-normal text-teal-600">
                          (AI-filled — edit as needed)
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {dictationText && (
                      <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-800">
                        <p className="font-medium mb-1">Dictated prescription:</p>
                        <p className="italic">&ldquo;{dictationText}&rdquo;</p>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm font-medium mb-2 block">Diagnosis</Label>
                      <Textarea
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="Enter patient's diagnosis…"
                        className="min-h-[80px]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-medium text-gray-700">Medications *</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addMed}
                          className="text-[#008080] border-[#008080] hover:bg-[#008080] hover:text-white"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add More
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {medications.map((med, idx) => (
                          <div key={med.id} className="border rounded-xl p-4 bg-gray-50 space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">
                                Medicine {idx + 1}
                              </Badge>
                              {medications.length > 1 && (
                                <button
                                  onClick={() => removeMed(med.id)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-gray-500 mb-1 block">Medicine Name *</Label>
                                <Input
                                  placeholder="e.g. Paracetamol"
                                  value={med.medication}
                                  onChange={(e) => updateMed(med.id, "medication", e.target.value)}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500 mb-1 block">Dosage &amp; Frequency</Label>
                                <Input
                                  placeholder="e.g. 650 mg, twice daily"
                                  value={med.dosage}
                                  onChange={(e) => updateMed(med.id, "dosage", e.target.value)}
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 block">Instructions</Label>
                              <Input
                                placeholder="e.g. for 5 days, after food"
                                value={med.instructions}
                                onChange={(e) => updateMed(med.id, "instructions", e.target.value)}
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={savePrescription}
                        disabled={isSaving}
                        className="bg-[#008080] hover:bg-[#008080]/90 text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? "Saving…" : "Save Prescription"}
                      </Button>
                      <Button variant="outline" onClick={onEndCall}>Skip</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN VIDEO CALL UI
  // ══════════════════════════════════════════════════════════════════════════
  const statusLabels: Record<PeerStatus, string> = {
    loading:   "Initialising secure connection…",
    waiting:   `Waiting for patient to join… (room: ms-doc-${getApptId()})`,
    connected: "Patient connected ✓",
    error:     peerError || "Connection failed",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Video Conference"
        onNavigateHome={onNavigateHome}
        onLogout={onLogout}
        userType="doctor"
      />

      <div className="pt-16 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* ── Main Video Area ──────────────────────────────────────── */}
            <div className="lg:col-span-3 space-y-4">

              {/* Top bar */}
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg">Consultation with {propPatientName}</h2>
                    <p className={`text-sm ${
                      peerStatus === "error"     ? "text-red-500"   :
                      peerStatus === "connected" ? "text-green-600" : "text-gray-500"
                    }`}>
                      {statusLabels[peerStatus]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={language}
                      onValueChange={(v) => {
                        setLanguage(v);
                        if (isRecording) { mediaRecorderRef.current?.stop(); setIsRecording(false); }
                      }}
                    >
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="hindi">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleEndCall}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      <PhoneOff className="w-4 h-4 mr-2" /> End Call
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Video container */}
              <Card className="min-h-[500px]">
                <CardContent className="p-0">
                  <div className="w-full h-[500px] bg-gray-900 rounded-lg overflow-hidden relative">

                    {/* Remote video — patient's feed */}
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />

                    {/* Status overlay when patient not yet connected */}
                    {peerStatus !== "connected" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                        <div className="text-center text-white space-y-3 px-6">
                          {peerStatus === "error" ? (
                            <>
                              <p className="text-red-400 text-lg">{peerError || "Connection failed"}</p>
                              <p className="text-gray-400 text-sm">Please refresh and try again.</p>
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#008080]" />
                              <p className="text-lg">{statusLabels[peerStatus]}</p>
                              {peerStatus === "waiting" && (
                                <p className="text-xs text-gray-400">
                                  Patient must join using the same appointment's "Join Call" button.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Local video — doctor's own camera (PiP) */}
                    <div className="absolute bottom-20 right-4 w-36 h-24 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-gray-800">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Controls */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 rounded-full px-6 py-3">
                      <Button
                        size="sm"
                        onClick={toggleMute}
                        title={isMuted ? "Unmute" : "Mute"}
                        className={`rounded-full w-12 h-12 ${
                          isMuted ? "bg-red-500 hover:bg-red-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                      >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </Button>

                      <Button
                        size="sm"
                        onClick={toggleCamera}
                        title={isCameraOff ? "Turn camera on" : "Turn camera off"}
                        className={`rounded-full w-12 h-12 ${
                          isCameraOff ? "bg-red-500 hover:bg-red-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                      >
                        {isCameraOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                      </Button>

                      {/* Prescription dictation button */}
                      <Button
                        size="sm"
                        onClick={toggleRecording}
                        title={isRecording ? "Stop dictation" : "Dictate prescription"}
                        className={`rounded-full w-12 h-12 ${
                          isRecording
                            ? "bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-300"
                            : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                      >
                        <Mic2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Side Panel ──────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Dictation card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      isRecording    ? "bg-red-500 animate-pulse"    :
                      isTranscribing ? "bg-yellow-400 animate-pulse" :
                      "bg-gray-300"
                    }`} />
                    {isRecording    ? "Recording…"          :
                     isTranscribing ? "Transcribing…"       :
                     "Prescription Dictation"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-gray-400">
                    Press <strong>🎙️</strong> below the video to record the prescription.
                    Whisper AI will extract medicines automatically (requires ML model running).
                    Otherwise, fill the form manually after ending the call.
                  </p>

                  {dictationText && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-700 italic">
                      &ldquo;{dictationText}&rdquo;
                    </div>
                  )}

                  {isTranscribing && (
                    <div className="flex items-center gap-2 text-xs text-yellow-600">
                      <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      Sending to Whisper…
                    </div>
                  )}

                  {extractError   && <p className="text-orange-500 text-xs">{extractError}</p>}
                  {extractSuccess && <p className="text-teal-600 text-xs font-medium">{extractSuccess}</p>}

                  {extractSuccess && medications[0].medication && (
                    <div className="space-y-1 pt-1">
                      {medications.map((m, i) => (
                        <div key={m.id} className="text-xs bg-teal-50 border border-teal-100 rounded-lg px-3 py-1.5">
                          <span className="font-medium text-teal-800">{i + 1}. {m.medication}</span>
                          {m.dosage && <span className="text-teal-600"> — {m.dosage}</span>}
                        </div>
                      ))}
                      <p className="text-xs text-gray-400 pt-1">Edit the full form after ending the call.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Quick notes during consultation…"
                    className="min-h-[100px] text-sm"
                  />
                </CardContent>
              </Card>

              {/* Patient History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Patient History</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-600">
                  <p className="italic">Ask patient for allergies and current medications.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
