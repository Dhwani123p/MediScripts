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

/** Inline confidence badge for AI-filled prescription fields. */
function ConfBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  if (score >= 0.85)
    return <span className="ml-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1 py-0.5">HIGH {pct}%</span>;
  if (score >= 0.65)
    return <span className="ml-1 text-[10px] font-semibold text-amber-500 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">MED {pct}%</span>;
  return <span className="ml-1 text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200 rounded px-1 py-0.5">LOW {pct}% ⚠</span>;
}

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

  // ── Resolved patient for this appointment ───────────────────────────────
  const [resolvedPatientId,   setResolvedPatientId]   = useState<number | null>(patientId ?? null);
  const [resolvedPatientName, setResolvedPatientName] = useState<string>(propPatientName);

  // ── Patient health profile (shown to doctor during call) ─────────────────
  const [patientProfile,    setPatientProfile]    = useState<any>(null);
  const [showPatientPanel,  setShowPatientPanel]  = useState(false);

  // ── Call controls ────────────────────────────────────────────────────────
  const [isMuted,       setIsMuted]       = useState(false);
  const [isCameraOff,   setIsCameraOff]   = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);

  // ── Prescription dictation ───────────────────────────────────────────────
  const [language,       setLanguage]       = useState("english");
  const [country,        setCountry]        = useState("");   // ISO/free-text for drug name mapping
  const [isRecording,    setIsRecording]    = useState(false);
  const [dictationText,  setDictationText]  = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [extractError,   setExtractError]   = useState("");
  const [extractSuccess, setExtractSuccess] = useState("");
  // medId → per-field confidence from ML dictation (cleared when user edits)
  const [medConf, setMedConf] = useState<Record<number, any>>({});
  // Drug-drug interactions returned by the ML API after audio extraction
  const [medInteractions, setMedInteractions] = useState<any[]>([]);
  // Dose-range warnings (WHO limits) from ML API
  const [doseWarnings, setDoseWarnings] = useState<any[]>([]);
  // Drug name mappings (INN → local name) from ML API
  const [drugMappings, setDrugMappings] = useState<any[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);

  // ── Quick notes (during call → pre-filled as diagnosis) ─────────────────
  const [quickNotes, setQuickNotes] = useState("");

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

  // ── Fetch patient from appointment (so prescription saves correctly) ─────
  useEffect(() => {
    const apptId = parseInt(getApptId());
    if (!apptId || patientId) return;          // already have it via prop
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/appointments`, { headers: authHeader() })
      .then((r) => r.json())
      .then((rows: any[]) => {
        if (!Array.isArray(rows)) return;
        const match = rows.find((a: any) => a.id === apptId);
        if (match) {
          setResolvedPatientId(match.patient_id);
          setResolvedPatientName(match.patient_name || "Patient");
          // Fetch patient health profile + reports
          if (match.patient_id) {
            Promise.all([
              fetch(`${API}/health-profile/patient/${match.patient_id}`, { headers: authHeader() }).then(r => r.json()),
              fetch(`${API}/health-profile/patient/${match.patient_id}/reports`, { headers: authHeader() }).then(r => r.json()),
            ]).then(([p, rpts]) => {
              if (!p.error) setPatientProfile({ ...p, reports: Array.isArray(rpts) ? rpts : [] });
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  // ── PeerJS initialisation ────────────────────────────────────────────────
  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;

    const getPeerOptions = () => {
      try {
        const u = new URL(API_BASE);
        return {
          host:   u.hostname,
          port:   u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80),
          path:   '/peerjs',
          secure: u.protocol === 'https:',
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
              { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            ],
          },
        };
      } catch { return {}; }
    };

    const initializePeer = () => {
      const doctorPeerId = `ms-doc-${getApptId()}`;
      const peer = new (window as any).Peer(doctorPeerId, getPeerOptions());
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
    // Pre-fill diagnosis from quick notes taken during the call
    if (quickNotes.trim()) setDiagnosis(quickNotes.trim());
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
    if (country) form.append("country", country);

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

      setDictationText((prev) =>
        prev ? `${prev} / ${data.transcript || ""}` : (data.transcript || "")
      );

      if (!data.medicines?.length || !data.medicines[0].drug) {
        setExtractError("No medicines detected — fill the prescription manually after ending the call.");
      } else {
        const filled: MedLine[] = data.medicines.map((m: any, i: number) => ({
          id:           Date.now() + i,
          medication:   m.drug || "",
          dosage:       [m.dose, m.frequency].filter(Boolean).join(", "),
          instructions: [m.duration, m.route].filter(Boolean).join(", "),
        }));
        // Store per-field confidence so badges appear on the prescription form
        const newConf: Record<number, any> = {};
        filled.forEach((med, i) => {
          if (data.medicines[i]?.confidence) newConf[med.id] = data.medicines[i].confidence;
        });

        // Append to existing list (skip the blank placeholder row if it's the only entry)
        setMedications((prev) => {
          const hasOnlyBlank = prev.length === 1 && !prev[0].medication.trim();
          return hasOnlyBlank ? filled : [...prev, ...filled];
        });
        setMedConf((prev) => ({ ...prev, ...newConf }));

        // Merge interactions — deduplicate by drug-pair key
        setMedInteractions((prev) => {
          const existing = new Set(prev.map((ix) => (ix.drugs || []).slice().sort().join("|")));
          const incoming = (data.interactions || []).filter(
            (ix: any) => !existing.has((ix.drugs || []).slice().sort().join("|"))
          );
          return [...prev, ...incoming];
        });

        // Merge dose warnings — deduplicate by drug name
        setDoseWarnings((prev) => {
          const seen = new Set(prev.map((d: any) => d.drug?.toLowerCase()));
          const incoming = (data.dose_warnings || []).filter(
            (d: any) => !seen.has(d.drug?.toLowerCase())
          );
          return [...prev, ...incoming];
        });

        // Merge drug mappings — deduplicate by INN
        setDrugMappings((prev) => {
          const seen = new Set(prev.map((m: any) => m.inn));
          const incoming = (data.drug_mappings || []).filter((m: any) => !seen.has(m.inn));
          return [...prev, ...incoming];
        });

        setExtractSuccess(`✅ ${filled.length} medicine(s) added — dictate again to add more, or edit below.`);
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

  const CONF_KEYS: Partial<Record<keyof MedLine, string[]>> = {
    medication:   ["drug"],
    dosage:       ["dose", "frequency"],
    instructions: ["duration", "route"],
  };

  const updateMed = (id: number, field: keyof MedLine, val: string) => {
    setMedications((prev) => prev.map((m) => m.id === id ? { ...m, [field]: val } : m));
    const keys = CONF_KEYS[field];
    if (keys && medConf[id]) {
      setMedConf((prev) => {
        const updated = { ...prev[id] };
        keys.forEach((k) => delete updated[k]);
        return { ...prev, [id]: updated };
      });
    }
  };

  const getMedConf = (medId: number, field: "medication" | "dosage" | "instructions"): number | null => {
    const c = medConf[medId];
    if (!c) return null;
    if (field === "medication") return c.drug ?? null;
    if (field === "dosage") {
      const vals = [c.dose, c.frequency].filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    if (field === "instructions") {
      const vals = [c.duration, c.route].filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    return null;
  };

  // ── Save prescription ────────────────────────────────────────────────────
  const savePrescription = async () => {
    const valid = medications.filter((m) => m.medication.trim());
    if (!valid.length) { alert("Please add at least one medication."); return; }
    const apptIdNum = parseInt(getApptId()) || null;
    if (!resolvedPatientId && !apptIdNum) {
      alert("Could not identify patient — please go back to dashboard and try again.");
      return;
    }

    setIsSaving(true);
    try {
      // Save ALL medicines as ONE prescription record
      const medicationsJson = JSON.stringify(
        valid.map((m) => ({ name: m.medication, dosage: m.dosage, instructions: m.instructions }))
      );
      const res = await fetch(`${API}/prescriptions`, {
        method:  "POST",
        headers: authHeader(),
        body:    JSON.stringify({
          patient_id:      resolvedPatientId || undefined,
          appointment_id:  apptIdNum,
          medication:      valid[0].medication,           // first med as summary field
          dosage:          valid.map((m) => m.dosage).filter(Boolean).join("; "),
          instructions:    valid.map((m) => m.instructions).filter(Boolean).join("; "),
          diagnosis:       diagnosis || undefined,
          medications_json: medicationsJson,              // full list as JSON
          interactions:    medInteractions,               // drug-drug interactions from ML
        }),
      });
      const data = await res.json();
      if (data.id) {
        setSaved(true);
        setTimeout(onEndCall, 2000);
      } else {
        alert("Failed to save prescription — " + (data.error || "please try again."));
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
                <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <FileText className="w-5 h-5" />
                      Prescription for {resolvedPatientName}
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

                    {/* Drug-interaction warnings from ML */}
                    {medInteractions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Drug Interactions Detected
                        </p>
                        {medInteractions.map((ix, i) => {
                          const isHigh = ix.severity === "high";
                          const isMod  = ix.severity === "moderate";
                          return (
                            <div
                              key={i}
                              className={`rounded-lg border px-3 py-2 text-xs ${
                                isHigh
                                  ? "bg-red-50 border-red-200 text-red-800"
                                  : isMod
                                  ? "bg-amber-50 border-amber-200 text-amber-800"
                                  : "bg-blue-50 border-blue-200 text-blue-800"
                              }`}
                            >
                              <span className="font-semibold mr-1">
                                {isHigh ? "⚠ HIGH" : isMod ? "△ MODERATE" : "ℹ LOW"}
                              </span>
                              <span className="font-semibold">{ix.drugs?.join(" + ")}: </span>
                              {ix.description}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Dose warnings on prescription form */}
                    {doseWarnings.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Dose Warnings
                        </p>
                        {doseWarnings.map((dw: any, di: number) =>
                          (dw.warnings || []).map((w: any, wi: number) => (
                            <div
                              key={`${di}-${wi}`}
                              className={`rounded-lg border px-3 py-2 text-xs ${
                                w.severity === "high"
                                  ? "bg-red-50 border-red-200 text-red-800"
                                  : "bg-amber-50 border-amber-200 text-amber-800"
                              }`}
                            >
                              <span className="font-semibold mr-1">
                                {w.severity === "high" ? "⛔ HIGH" : "⚠ MODERATE"}
                              </span>
                              {w.message}
                              <div className="mt-1 opacity-60">{w.who_limit} · {w.source}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Drug name mappings for patient's country */}
                    {drugMappings.length > 0 && (
                      <div className="rounded-xl border border-green-200 overflow-hidden">
                        <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                            Local Drug Names
                          </p>
                        </div>
                        <div className="divide-y divide-green-100">
                          {drugMappings.map((m: any, i: number) => (
                            <div key={i} className="px-4 py-2.5 text-xs flex items-start gap-2 bg-white">
                              <div className="flex-1">
                                <span className="font-semibold text-gray-700">{m.source_name}</span>
                                {m.mapped && m.local_name !== m.source_name && (
                                  <span className="text-green-700"> → <span className="font-semibold">{m.local_name}</span></span>
                                )}
                                {m.brand_examples?.length > 0 && (
                                  <span className="text-gray-400 ml-1">({m.brand_examples.slice(0, 3).join(", ")})</span>
                                )}
                                {m.note && <div className="text-amber-600 mt-0.5">{m.note}</div>}
                              </div>
                              <span className="text-gray-400 shrink-0">{m.country_name}</span>
                            </div>
                          ))}
                        </div>
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
                                <Label className="text-xs text-gray-500 mb-1 flex items-center">
                                  Medicine Name *
                                  {getMedConf(med.id, "medication") !== null && (
                                    <ConfBadge score={getMedConf(med.id, "medication")!} />
                                  )}
                                </Label>
                                <Input
                                  placeholder="e.g. Paracetamol"
                                  value={med.medication}
                                  onChange={(e) => updateMed(med.id, "medication", e.target.value)}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500 mb-1 flex items-center">
                                  Dosage &amp; Frequency
                                  {getMedConf(med.id, "dosage") !== null && (
                                    <ConfBadge score={getMedConf(med.id, "dosage")!} />
                                  )}
                                </Label>
                                <Input
                                  placeholder="e.g. 650 mg, twice daily"
                                  value={med.dosage}
                                  onChange={(e) => updateMed(med.id, "dosage", e.target.value)}
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 mb-1 flex items-center">
                                Instructions
                                {getMedConf(med.id, "instructions") !== null && (
                                  <ConfBadge score={getMedConf(med.id, "instructions")!} />
                                )}
                              </Label>
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
                </>
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
                    <h2 className="text-lg">Consultation with {resolvedPatientName}</h2>
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
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Patient's country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No mapping</SelectItem>
                        <SelectItem value="IN">🇮🇳 India</SelectItem>
                        <SelectItem value="US">🇺🇸 USA</SelectItem>
                        <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                        <SelectItem value="AE">🇦🇪 UAE / Dubai</SelectItem>
                        <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                        <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                        <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                        <SelectItem value="FR">🇫🇷 France</SelectItem>
                        <SelectItem value="SA">🇸🇦 Saudi Arabia</SelectItem>
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

                  {/* Dose warnings in side panel */}
                  {doseWarnings.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-gray-100 mt-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Dose Warnings
                      </p>
                      {doseWarnings.map((dw: any, di: number) =>
                        (dw.warnings || []).map((w: any, wi: number) => (
                          <div
                            key={`${di}-${wi}`}
                            className={`text-xs rounded-lg px-3 py-1.5 border ${
                              w.severity === "high"
                                ? "bg-red-50 border-red-100 text-red-800"
                                : "bg-amber-50 border-amber-100 text-amber-800"
                            }`}
                          >
                            <span className="font-semibold">
                              {w.severity === "high" ? "⛔" : "⚠"} {dw.drug}:
                            </span>{" "}
                            {w.who_limit}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Drug name mappings for patient's country */}
                  {drugMappings.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-gray-100 mt-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Local drug names
                      </p>
                      {drugMappings.map((m: any, i: number) => (
                        <div key={i} className={`text-xs rounded-lg px-3 py-1.5 border ${
                          m.mapped
                            ? "bg-green-50 border-green-100 text-green-800"
                            : "bg-amber-50 border-amber-100 text-amber-700"
                        }`}>
                          <span className="font-semibold">{m.source_name}</span>
                          {m.mapped && m.local_name !== m.source_name && (
                            <span> → <span className="font-semibold">{m.local_name}</span></span>
                          )}
                          {m.brand_examples?.length > 0 && (
                            <span className="text-gray-500"> ({m.brand_examples.slice(0, 2).join(", ")})</span>
                          )}
                          {m.note && (
                            <div className="text-amber-600 mt-0.5">{m.note}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Notes — wired to diagnosis on prescription form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Symptoms, observations… (auto-fills Diagnosis field)"
                    className="min-h-[90px] text-sm"
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Will pre-fill the Diagnosis box in the prescription form.</p>
                </CardContent>
              </Card>

              {/* Patient History — full health profile during call */}
              <Card className={patientProfile ? "border-blue-200" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>👤 Patient History</span>
                    {patientProfile && (
                      <button
                        onClick={() => setShowPatientPanel(v => !v)}
                        className="text-xs text-blue-500 hover:underline font-normal"
                      >
                        {showPatientPanel ? "Collapse" : "Expand"}
                      </button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs space-y-2">
                  {!patientProfile ? (
                    <p className="text-gray-400 italic">Loading patient profile…</p>
                  ) : (
                    <>
                      {/* Always visible: key vitals */}
                      <div className="flex flex-wrap gap-2">
                        {patientProfile.gender && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{patientProfile.gender}</span>}
                        {patientProfile.blood_group && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold">{patientProfile.blood_group}</span>}
                        {patientProfile.weight_kg && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{patientProfile.weight_kg} kg</span>}
                        {patientProfile.height_cm && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{patientProfile.height_cm} cm</span>}
                      </div>
                      {/* Always visible: allergies warning */}
                      {patientProfile.allergies && (
                        <div className="bg-red-50 border border-red-200 rounded px-2 py-1.5 text-red-700">
                          <strong>⚠️ Allergies:</strong> {patientProfile.allergies}
                        </div>
                      )}
                      {!patientProfile.allergies && (
                        <p className="text-gray-400 text-xs">No known allergies on file.</p>
                      )}

                      {/* Expanded details */}
                      {showPatientPanel && (
                        <div className="space-y-2 pt-1 border-t border-blue-100 mt-1">
                          {patientProfile.chronic_conditions && (
                            <div><span className="font-semibold text-gray-700">Chronic:</span> {patientProfile.chronic_conditions}</div>
                          )}
                          {patientProfile.current_medications && (
                            <div><span className="font-semibold text-gray-700">Current Meds:</span> {patientProfile.current_medications}</div>
                          )}
                          {patientProfile.past_surgeries && (
                            <div><span className="font-semibold text-gray-700">Surgeries:</span> {patientProfile.past_surgeries}</div>
                          )}
                          {patientProfile.family_history && (
                            <div><span className="font-semibold text-gray-700">Family:</span> {patientProfile.family_history}</div>
                          )}
                          {/* Previous Prescriptions */}
                          {patientProfile.prescriptions?.length > 0 && (
                            <div>
                              <p className="font-semibold text-gray-700 mb-1">Past Prescriptions:</p>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {patientProfile.prescriptions.map((p: any, i: number) => (
                                  <div key={i} className="bg-white rounded px-2 py-1 border border-blue-100">
                                    <span className="font-medium">{p.medication}</span>
                                    {p.dosage && <span className="text-gray-500"> · {p.dosage}</span>}
                                    <span className="float-right text-gray-400">{new Date(p.prescribed_date).toLocaleDateString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Uploaded Reports */}
                          {patientProfile.reports?.length > 0 && (
                            <div>
                              <p className="font-semibold text-gray-700 mb-1">Reports ({patientProfile.reports.length}):</p>
                              <div className="space-y-1 max-h-28 overflow-y-auto">
                                {patientProfile.reports.map((r: any) => (
                                  <div key={r.id} className="flex items-center justify-between bg-white rounded px-2 py-1 border border-blue-100">
                                    <div className="min-w-0 mr-2">
                                      <span className="font-medium truncate block">{r.file_name}</span>
                                      <span className="text-gray-400">{r.report_type} · {new Date(r.uploaded_at).toLocaleDateString()}</span>
                                    </div>
                                    <button
                                      className="text-[#008080] hover:underline flex-shrink-0"
                                      onClick={() => {
                                        fetch(`${API}/health-profile/reports/${r.id}/doctor-view`, { headers: authHeader() })
                                          .then(res => res.blob())
                                          .then(blob => window.open(URL.createObjectURL(blob), "_blank"));
                                      }}
                                    >View</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {!patientProfile.chronic_conditions && !patientProfile.current_medications &&
                           !patientProfile.past_surgeries && !patientProfile.prescriptions?.length && (
                            <p className="text-gray-400 italic">No detailed history on file.</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
