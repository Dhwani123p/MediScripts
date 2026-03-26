import { useEffect, useState, useRef } from "react";
import { API_BASE } from "../lib/config";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { DashboardHeader } from "./DashboardHeader";
import { PhoneOff, Mic, MicOff, Camera, CameraOff, Loader2 } from "lucide-react";

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

  // ── PeerJS / WebRTC refs ─────────────────────────────────────────────────
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

  /** Extract numeric appointment ID from roomName, e.g. "mediscript-appt-42" → "42" */
  const getApptId = () => {
    const match = (roomName || "").match(/(\d+)$/);
    return match ? match[1] : "demo";
  };

  // ── PeerJS: connect to doctor ────────────────────────────────────────────
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

      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
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

            call.on("close", () => {
              setErrorMsg("Call ended by the doctor.");
              setStatus("error");
            });

            call.on("error", () => {
              setErrorMsg("Could not reach the doctor. Make sure the doctor has joined first, then retry.");
              setStatus("error");
            });
          });

          peer.on("error", (err: any) => {
            if (err.type === "peer-unavailable") {
              setErrorMsg(`Doctor is not in the room yet (room: ${doctorPeerId}). Ask the doctor to join first, then refresh this page.`);
            } else {
              setErrorMsg(`Connection error: ${err.type || "unknown"}. Please refresh and try again.`);
            }
            setStatus("error");
          });
        })
        .catch(() => {
          setErrorMsg("Camera or microphone access was denied. Please allow access and refresh.");
          setStatus("error");
        });
    };

    const loadPeerJS = () => {
      if ((window as any).Peer) { startCall((window as any).Peer); return; }
      const script = document.createElement("script");
      script.src   = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
      script.async = true;
      script.onload  = () => startCall((window as any).Peer);
      script.onerror = () => {
        setErrorMsg("Failed to load video library. Check your internet connection.");
        setStatus("error");
      };
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

  // ── Controls ─────────────────────────────────────────────────────────────
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

  const statusMessages: Record<CallStatus, string> = {
    loading:    "Loading video library…",
    connecting: `Connecting to doctor (room: ms-doc-${getApptId()})…`,
    connected:  "Connected to doctor ✓",
    error:      errorMsg || "Connection failed",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Video Conference"
        onNavigateHome={onNavigateHome}
        onLogout={onLogout}
        userType="patient"
      />

      <div className="pt-16 p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Status bar */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg">Consultation with Doctor</h2>
                <p className={`text-sm ${
                  status === "error"     ? "text-red-500"   :
                  status === "connected" ? "text-green-600" : "text-gray-500"
                }`}>
                  {statusMessages[status]}
                </p>
              </div>
              <Button
                onClick={handleEndCall}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <PhoneOff className="w-4 h-4 mr-2" /> End Call
              </Button>
            </CardContent>
          </Card>

          {/* Video container */}
          <Card>
            <CardContent className="p-0">
              <div className="w-full h-[560px] bg-gray-900 rounded-lg overflow-hidden relative">

                {/* Remote video — doctor's camera */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Status overlay when not yet connected */}
                {status !== "connected" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/85">
                    <div className="text-center text-white space-y-4 px-8 max-w-md">
                      {status === "error" ? (
                        <>
                          <p className="text-red-400 text-base leading-relaxed">{errorMsg || "Connection failed"}</p>
                          <Button
                            onClick={() => window.location.reload()}
                            variant="outline"
                            size="sm"
                            className="text-white border-white hover:bg-white/10"
                          >
                            Retry
                          </Button>
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#008080]" />
                          <p className="text-lg">{statusMessages[status]}</p>
                          <p className="text-xs text-gray-400">
                            Make sure your doctor has also clicked "Join Call" for this appointment.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Local video — patient's own camera (PiP) */}
                <div className="absolute bottom-20 right-4 w-36 h-24 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-gray-800">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Call controls */}
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">During Your Consultation:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Speak clearly and describe your symptoms in detail</li>
                <li>• Have any relevant medical documents ready</li>
                <li>• Ask questions about your diagnosis or treatment</li>
                <li>• The doctor will provide a prescription after the consultation</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
