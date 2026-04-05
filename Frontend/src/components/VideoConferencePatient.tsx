import { useEffect, useState, useRef } from "react";
import { API_BASE } from "../lib/config";
import { Button } from "./ui/button";
import {
  PhoneOff, Mic, MicOff, Camera, CameraOff, Loader2,
  Heart, Clock, FileText, AlertCircle, CheckCircle2
} from "lucide-react";

interface VideoConferencePatientProps {
  roomName?:      string;
  onEndCall:      () => void;
  onNavigateHome: () => void;
  onLogout:       () => void;
}

export function VideoConferencePatient({
  roomName,
  onEndCall,
  onNavigateHome,
  onLogout,
}: VideoConferencePatientProps) {

  const peerRef        = useRef<any>(null);
  const callRef        = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  type CallStatus = 'loading' | 'connecting' | 'connected' | 'error';
  const [status,      setStatus]      = useState<CallStatus>('loading');
  const [errorMsg,    setErrorMsg]    = useState("");
  const [isMuted,     setIsMuted]     = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const getApptId = () => {
    const match = (roomName || "").match(/(\d+)$/);
    return match ? match[1] : "demo";
  };

  // Timer
  useEffect(() => {
    if (status !== "connected") return;
    const t = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // PeerJS
  useEffect(() => {
    const doctorPeerId = `ms-doc-${(roomName || "").match(/(\d+)$/)?.[1] ?? "demo"}`;

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

    const startCall = (Peer: any) => {
      setStatus("connecting");
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;

          const peer = new Peer(undefined, getPeerOptions());
          peerRef.current = peer;

          peer.on("open", () => {
            const call = peer.call(doctorPeerId, stream);
            callRef.current = call;
            call.on("stream", (remoteStream: MediaStream) => {
              if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
              setStatus("connected");
            });
            call.on("close", () => { setErrorMsg("Call ended by the doctor."); setStatus("error"); });
            call.on("error", () => { setErrorMsg("Could not reach the doctor."); setStatus("error"); });
          });

          peer.on("error", (err: any) => {
            if (err.type === "peer-unavailable") {
              setErrorMsg(`Doctor hasn't joined yet. Ask them to join, then refresh.`);
            } else {
              setErrorMsg(`Connection error: ${err.type || "unknown"}.`);
            }
            setStatus("error");
          });
        })
        .catch(() => {
          setErrorMsg("Camera/microphone access denied. Please allow and refresh.");
          setStatus("error");
        });
    };

    const loadPeerJS = () => {
      if ((window as any).Peer) { startCall((window as any).Peer); return; }
      const script = document.createElement("script");
      script.src   = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
      script.async = true;
      script.onload  = () => startCall((window as any).Peer);
      script.onerror = () => { setErrorMsg("Failed to load video library."); setStatus("error"); };
      document.body.appendChild(script);
    };

    loadPeerJS();
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      callRef.current?.close();
      peerRef.current?.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndCall = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    callRef.current?.close();
    peerRef.current?.destroy();
    onEndCall();
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

  return (
    <div className="h-screen bg-[#0d1117] flex flex-col overflow-hidden">

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#161b22] border-b border-white/10">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
            <Heart size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm">MediScript</span>
        </div>

        {/* Status pill */}
        <div className="flex items-center space-x-2">
          {status === "connected" && (
            <span className="flex items-center space-x-1.5 bg-green-500/20 border border-green-500/30 text-green-400 text-xs px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span>Live · {formatDuration(callDuration)}</span>
            </span>
          )}
          {status === "connecting" && (
            <span className="flex items-center space-x-1.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs px-3 py-1 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Connecting…</span>
            </span>
          )}
          {status === "loading" && (
            <span className="flex items-center space-x-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs px-3 py-1 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading…</span>
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center space-x-1.5 bg-red-500/20 border border-red-500/30 text-red-400 text-xs px-3 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />
              <span>Disconnected</span>
            </span>
          )}
        </div>

        {/* End call */}
        <Button onClick={handleEndCall} className="bg-red-500 hover:bg-red-600 text-white rounded-full px-5 py-2 text-sm h-auto">
          <PhoneOff className="w-4 h-4 mr-2" /> End Call
        </Button>
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video area */}
        <div className="flex-1 flex flex-col p-4 gap-4">

          {/* Remote video (doctor) */}
          <div className="relative flex-1 bg-[#1a1f2e] rounded-2xl overflow-hidden min-h-0">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Doctor label */}
            {status === "connected" && (
              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full flex items-center space-x-1.5">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                <span>Doctor</span>
              </div>
            )}

            {/* Overlay when not connected */}
            {status !== "connected" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1a1f2e]">
                <div className="text-center space-y-4 px-8 max-w-sm">
                  {status === "error" ? (
                    <>
                      <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-7 h-7 text-red-400" />
                      </div>
                      <p className="text-red-300 text-sm leading-relaxed">{errorMsg}</p>
                      <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10">
                        Retry
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
                        <Loader2 className="w-7 h-7 text-teal-400 animate-spin" />
                      </div>
                      <p className="text-white text-sm">Waiting for doctor to join…</p>
                      <p className="text-gray-400 text-xs">Make sure your doctor has clicked "Join Call"</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Local video PiP */}
            <div className="absolute bottom-4 right-4 w-32 h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl bg-gray-800">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">You</div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-5 py-2.5">
              <button
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                  isMuted ? "bg-red-500 hover:bg-red-600" : "bg-white/20 hover:bg-white/30"
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
              </button>
              <button
                onClick={toggleCamera}
                title={isCameraOff ? "Camera on" : "Camera off"}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                  isCameraOff ? "bg-red-500 hover:bg-red-600" : "bg-white/20 hover:bg-white/30"
                }`}
              >
                {isCameraOff ? <CameraOff className="w-5 h-5 text-white" /> : <Camera className="w-5 h-5 text-white" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────── */}
        <div className="w-72 bg-[#161b22] border-l border-white/10 flex flex-col p-4 gap-4 overflow-y-auto">

          {/* Consultation info */}
          <div className="bg-[#1a1f2e] rounded-xl p-4 space-y-3">
            <h3 className="text-white font-semibold text-sm flex items-center space-x-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>Consultation</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Room</span>
                <span className="text-gray-300 font-mono">#{getApptId()}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Duration</span>
                <span className="text-gray-300 font-mono">{formatDuration(callDuration)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Status</span>
                <span className={
                  status === "connected" ? "text-green-400" :
                  status === "error"     ? "text-red-400"   : "text-yellow-400"
                }>
                  {status === "connected" ? "Live" : status === "error" ? "Error" : "Connecting"}
                </span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-[#1a1f2e] rounded-xl p-4 space-y-3">
            <h3 className="text-white font-semibold text-sm flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>During Your Visit</span>
            </h3>
            <ul className="space-y-2">
              {[
                "Speak clearly about your symptoms",
                "Have your medical records ready",
                "Ask questions freely",
                "Doctor will share prescription after call",
              ].map((tip, i) => (
                <li key={i} className="flex items-start space-x-2 text-xs text-gray-400">
                  <span className="text-teal-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* End call button */}
          <Button
            onClick={handleEndCall}
            className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl mt-auto"
          >
            <PhoneOff className="w-4 h-4 mr-2" /> End Consultation
          </Button>
        </div>
      </div>
    </div>
  );
}
