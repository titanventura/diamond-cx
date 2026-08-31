import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { AudioManager } from "@/lib/audio-manager";
import { CameraManager } from "@/lib/camera-manager";
import { getWebSocketUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Square,
  Radio,
  Send,
  Trash2,
  Headphones,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  X,
  AlertTriangle,
  FileText,
  DollarSign,
  Wrench,
  HelpCircle,
  Camera,
  Activity,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

interface FeedMessage {
  id: string;
  role: "user" | "agent" | "system" | "tool_call" | "tool_response";
  author: string;
  text?: string;
  time: string;
  isError?: boolean;
  toolData?: any;
}

export const ConciergeView: React.FC<{
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}> = ({ initialPrompt, onClearInitialPrompt }) => {
  const {
    currentUser,
    sessionId,
    voice,
    modality,
    activeOrderContext,
    setActiveOrderContext,
    fetchOrders,
  } = useApp();

  // Connection & Media States
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [liveActivity, setLiveActivity] = useState<"Ready" | "Listening" | "Speaking">("Ready");
  const [mobileTab, setMobileTab] = useState<"feed" | "studio">("feed");

  // Interaction Log Feed
  const [messages, setMessages] = useState<FeedMessage[]>([
    {
      id: "initial-sys-msg",
      role: "system",
      author: "SYSTEM",
      text: "Live session ready. Connect via voice, video stream, or text to diagnose desk errors, review specifications, or process order refunds.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [textInput, setTextInput] = useState("");

  // Refs for persistent instances and DOM elements
  const wsRef = useRef<WebSocket | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const cameraManagerRef = useRef<CameraManager | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Auto-scroll feed
  const scrollToBottom = () => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Audio Manager Setup
  useEffect(() => {
    const audioMgr = new AudioManager({
      onAudioChunk: (arrayBuffer) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(arrayBuffer);
        }
      },
      onMicVolume: (vol) => {
        setVolumeLevel(vol);
        if (wsRef.current && isConnected) {
          setLiveActivity(vol > 0.08 ? "Speaking" : "Listening");
        }
      },
    });

    audioManagerRef.current = audioMgr;

    return () => {
      audioMgr.stop();
    };
  }, [isConnected]);

  // Camera Manager Setup
  useEffect(() => {
    const camMgr = new CameraManager({
      fps: 1,
      quality: 0.7,
      onFrame: (payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
        }
      },
    });

    cameraManagerRef.current = camMgr;

    return () => {
      camMgr.stop();
    };
  }, []);

  // Visualizer Waveform Loop
  useEffect(() => {
    if (!isConnected) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      setLiveActivity("Ready");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const bars = 28;
      const barWidth = width / bars;

      for (let i = 0; i < bars; i++) {
        const freq = Math.sin(Date.now() * 0.006 + i * 0.35) * 0.5 + 0.5;
        const barHeight = Math.max(3, freq * height * Math.max(0.2, volumeLevel * 2.5));

        const grad = ctx.createLinearGradient(0, height - barHeight, 0, height);
        grad.addColorStop(0, "#00f0ff");
        grad.addColorStop(1, "#0284c7");

        ctx.fillStyle = grad;
        ctx.fillRect(i * barWidth + 2, height - barHeight, barWidth - 3, barHeight);
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isConnected, volumeLevel]);

  // WebSocket Live Message Handler
  const handleLiveMessage = useCallback(
    (data: string) => {
      try {
        const event = JSON.parse(data);

        // 1. Audio Output Chunk
        if (event.audio && event.audio.data) {
          audioManagerRef.current?.playAudioChunk(
            event.audio.data,
            event.audio.mimeType || event.audio.mime_type
          );
        }

        // 2. Transcription Events
        if (event.userTranscription?.text) {
          setMessages((prev) => [
            ...prev,
            {
              id: "msg-" + Date.now() + Math.random(),
              role: "user",
              author: currentUser.name,
              text: event.userTranscription.text,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }

        if (event.agentTranscription?.text) {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === "agent" && lastMsg.author === "Diamond Concierge") {
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, text: (lastMsg.text || "") + event.agentTranscription.text },
              ];
            }
            return [
              ...prev,
              {
                id: "msg-" + Date.now() + Math.random(),
                role: "agent",
                author: "Diamond Concierge",
                text: event.agentTranscription.text,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ];
          });
        }

        // 3. ADK Content Parts
        const parts: any[] = [];
        if (event.content?.parts) parts.push(...event.content.parts);
        if (event.serverContent?.modelTurn?.parts) parts.push(...event.serverContent.modelTurn.parts);
        if (event.server_content?.model_turn?.parts)
          parts.push(...event.server_content.model_turn.parts);

        for (const part of parts) {
          const inlineData = part.inlineData || part.inline_data;
          if (inlineData && inlineData.data) {
            audioManagerRef.current?.playAudioChunk(
              inlineData.data,
              inlineData.mimeType || inlineData.mime_type
            );
          }

          if (part.text) {
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === "agent") {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMsg, text: (lastMsg.text || "") + part.text },
                ];
              }
              return [
                ...prev,
                {
                  id: "msg-" + Date.now() + Math.random(),
                  role: "agent",
                  author: "Diamond Concierge",
                  text: part.text,
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ];
            });
          }

          const fnCall = part.functionCall || part.function_call;
          if (fnCall) {
            setMessages((prev) => [
              ...prev,
              {
                id: "call-" + Date.now() + Math.random(),
                role: "tool_call",
                author: fnCall.name,
                toolData: fnCall.args || {},
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]);
          }

          const fnResp = part.functionResponse || part.function_response;
          if (fnResp) {
            const respData = fnResp.response || fnResp;
            setMessages((prev) => [
              ...prev,
              {
                id: "resp-" + Date.now() + Math.random(),
                role: "tool_response",
                author: fnResp.name || "Tool Response",
                toolData: respData,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]);

            // If a refund was authorized, trigger orders refresh
            if (fnResp.name === "issue_order_refund_or_replacement" || respData?.refund_id) {
              fetchOrders();
              toast.success("Refund Authorized & Processed!", {
                description: `Refund ID #${respData?.refund_id || "REF-SETTLED"} for $499.00 USD.`,
              });
            }
          }
        }
      } catch (err) {
        console.error("Error parsing live WebSocket event:", err);
      }
    },
    [currentUser.name, fetchOrders]
  );

  // Connect & Disconnect Session
  const disconnectLiveSession = useCallback(() => {
    setIsConnected(false);
    setIsConnecting(false);

    audioManagerRef.current?.stop();
    cameraManagerRef.current?.stop();
    setIsCameraOn(false);

    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "User disconnected");
      } catch (_) {}
      wsRef.current = null;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: "disc-" + Date.now(),
        role: "system",
        author: "SYSTEM",
        text: "Live session ended.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, []);

  const connectLiveSession = useCallback(async () => {
    if (isConnected) {
      disconnectLiveSession();
      return;
    }

    setIsConnecting(true);

    try {
      if (!audioManagerRef.current) return;
      await audioManagerRef.current.initialize();

      const wsUrl = getWebSocketUrl(currentUser.id, sessionId, voice, modality);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = async () => {
        setIsConnected(true);
        setIsConnecting(false);

        setMessages((prev) => [
          ...prev,
          {
            id: "conn-" + Date.now(),
            role: "system",
            author: "SYSTEM",
            text: "Connected to Gemini 3.1 Live. Bidirectional voice, vision, and dynamic redressal are active.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        // Start microphone
        await audioManagerRef.current?.startMicrophone();

        // Inject active order context if present
        if (activeOrderContext) {
          const intro =
            `[CUSTOMER CONTEXT] Customer Name: ${currentUser.name}. Active Order ID: ${activeOrderContext.order_id}. ` +
            `Product: ${activeOrderContext.product_name}. Serial Number: ${activeOrderContext.serial_number}. ` +
            `Amount Paid: ${activeOrderContext.price}. Warranty: ${activeOrderContext.warranty_status}. ` +
            `Please acknowledge this order and ask how you can help troubleshoot or diagnose their desk.`;
          
          ws.send(JSON.stringify({ type: "text", text: intro }));
        }
      };

      ws.onmessage = (evt) => {
        handleLiveMessage(evt.data);
      };

      ws.onerror = (err) => {
        console.error("Live WebSocket error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: "err-" + Date.now(),
            role: "system",
            author: "SYSTEM",
            text: "Connection error with Live session.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isError: true,
          },
        ]);
      };

      ws.onclose = () => {
        disconnectLiveSession();
      };
    } catch (err: any) {
      console.error("Live connection failed:", err);
      setIsConnecting(false);
      disconnectLiveSession();
      toast.error("Live Connection Failed", {
        description: err.message || "Could not connect to Gemini Live streaming server.",
      });
    }
  }, [
    isConnected,
    disconnectLiveSession,
    currentUser.id,
    currentUser.name,
    sessionId,
    voice,
    modality,
    activeOrderContext,
    handleLiveMessage,
  ]);

  // Handle Initial Prompt if passed from storefront
  useEffect(() => {
    if (initialPrompt) {
      if (!isConnected) {
        connectLiveSession().then(() => {
          setTimeout(() => {
            sendTextMessage(initialPrompt);
            onClearInitialPrompt?.();
          }, 1200);
        });
      } else {
        sendTextMessage(initialPrompt);
        onClearInitialPrompt?.();
      }
    }
  }, [initialPrompt]);

  // Send Text Message
  const sendTextMessage = (text: string) => {
    if (!text.trim()) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error("Not Connected", {
        description: "Please start a live session before sending messages.",
      });
      return;
    }

    const payload = { type: "text", text: text.trim() };
    wsRef.current.send(JSON.stringify(payload));

    setMessages((prev) => [
      ...prev,
      {
        id: "usr-" + Date.now() + Math.random(),
        role: "user",
        author: currentUser.name,
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    setTextInput("");
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (!cameraManagerRef.current || !videoRef.current) return;

    if (!isCameraOn) {
      try {
        await cameraManagerRef.current.start(videoRef.current);
        setIsCameraOn(true);
        setMessages((prev) => [
          ...prev,
          {
            id: "cam-" + Date.now(),
            role: "system",
            author: "SYSTEM",
            text: "Camera enabled. Gemini Live is now inspecting visual desk frames at 1 FPS.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } catch (err: any) {
        toast.error("Camera Access Denied", { description: err.message });
      }
    } else {
      cameraManagerRef.current.stop();
      setIsCameraOn(false);
      setMessages((prev) => [
        ...prev,
        {
          id: "cam-off-" + Date.now(),
          role: "system",
          author: "SYSTEM",
          text: "Camera disabled.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  // Switch Camera device (Front/Back)
  const handleSwitchCamera = async () => {
    if (cameraManagerRef.current && isCameraOn) {
      const switched = await cameraManagerRef.current.switchCamera();
      if (switched) {
        toast.info("Switched Camera", {
          description: `Camera facing mode: ${cameraManagerRef.current.facingMode}`,
        });
      }
    }
  };

  // Toggle Mic Mute
  const toggleMic = () => {
    const nextMute = !isMicMuted;
    setIsMicMuted(nextMute);
    audioManagerRef.current?.setMute(nextMute);
    toast.info(nextMute ? "Microphone Muted" : "Microphone Active");
  };

  // Interrupt Speech
  const handleInterrupt = () => {
    audioManagerRef.current?.interruptPlayback();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "activity_start" }));
    }
    toast.info("Interrupted Concierge Speech");
  };

  // Quick Inquiries Chips
  const QUICK_PROMPTS = [
    {
      label: "Motor Defect • Full Refund",
      prompt:
        "My desk dual motor is completely jammed and making a grinding noise. Please process a full refund.",
      alert: true,
    },
    {
      label: "Fix 'rST' Reset Code",
      prompt:
        "My desk control panel display flashes 'rST' and will not move. How do I reset it?",
    },
    {
      label: "E01 / HOT Overheating Guide",
      prompt: "The desk screen shows error code E01 or HOT. What does this mean?",
    },
    {
      label: "Memory Presets Config",
      prompt: "How do I save height presets 1, 2, and 3 on the 7-button LED memory panel?",
    },
    {
      label: "Check Warranty & Order",
      prompt: "Can you check the warranty and delivery details for my height adjustable desk order?",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8 animate-in fade-in-50 duration-300 flex flex-col space-y-4">
      {/* Active Order Context Banner */}
      {activeOrderContext && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 sm:p-4 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground truncate">
                  Active Support Context: Order #{activeOrderContext.order_id}
                </span>
                <Badge variant="cyan" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                  Pre-Loaded
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {activeOrderContext.product_name} &bull; Serial: {activeOrderContext.serial_number} &bull; Warranty: {activeOrderContext.warranty_status || "Active"}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => {
              setActiveOrderContext(null);
              toast.info("Order Context Disconnected");
            }}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
            title="Disconnect Order Context"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="md:hidden">
        <Tabs value={mobileTab} onValueChange={(v: any) => setMobileTab(v)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full h-9 bg-muted/60">
            <TabsTrigger value="feed" className="text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span>Diagnostic Feed</span>
            </TabsTrigger>
            <TabsTrigger value="studio" className="text-xs gap-1.5">
              <Camera className="h-3.5 w-3.5" />
              <span>Camera &amp; Studio</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* Left Column: Camera, Waveform & Controls (Studio Column) */}
        <div
          className={`md:col-span-5 flex flex-col space-y-4 ${
            mobileTab === "studio" ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Camera Feed Card */}
          <Card className="border-border/80 bg-card overflow-hidden shadow-xs">
            <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-cyan-400" />
                <span>Camera Stream</span>
              </CardTitle>
              {isCameraOn && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwitchCamera}
                  className="h-6 text-[11px] gap-1 px-2 text-cyan-400 hover:text-cyan-300"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Switch</span>
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-muted/40 border border-border/80 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${isCameraOn ? "block" : "hidden"}`}
                />
                {!isCameraOn && (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <Camera className="h-8 w-8 text-muted-foreground opacity-50 mb-2" />
                    <p className="text-xs text-muted-foreground mb-2">Camera Standby</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleCamera}
                      className="h-7 text-xs border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
                    >
                      Enable Camera
                    </Button>
                  </div>
                )}
                {isCameraOn && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    <span>1 FPS Live Snapshot</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Voice Waveform & Visualizer Card */}
          <Card className="border-border/80 bg-card shadow-xs">
            <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                <span>Voice Spectrum</span>
              </CardTitle>
              <Badge
                variant={liveActivity === "Speaking" ? "success" : "cyan"}
                className="text-[10px] px-2 py-0"
              >
                {isConnected ? liveActivity : "Offline"}
              </Badge>
            </CardHeader>
            <CardContent className="p-3.5 pt-0 space-y-2">
              <div className="rounded-lg bg-muted/30 border border-border/60 p-2 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={36}
                  className="w-full h-9 rounded"
                />
              </div>

              {/* Volume Track */}
              <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.round(volumeLevel * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Live Session Controls Card */}
          <Card className="border-border/80 bg-card shadow-xs">
            <CardContent className="p-3.5 space-y-3">
              <div className="flex gap-2">
                <Button
                  size="lg"
                  onClick={connectLiveSession}
                  disabled={isConnecting}
                  className={`flex-1 gap-2 font-bold text-xs sm:text-sm h-11 transition-all ${
                    isConnected
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : "bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-md hover:shadow-cyan-500/20"
                  }`}
                >
                  <Radio className={`h-4 w-4 ${isConnected ? "animate-pulse" : ""}`} />
                  <span>
                    {isConnecting
                      ? "Connecting..."
                      : isConnected
                      ? "End Live Session"
                      : "Start Live Session"}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  disabled={!isConnected}
                  onClick={toggleMic}
                  className={`h-11 w-11 shrink-0 ${
                    isMicMuted ? "border-destructive text-destructive bg-destructive/10" : ""
                  }`}
                  title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-cyan-400" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  disabled={!isConnected}
                  onClick={toggleCamera}
                  className={`h-11 w-11 shrink-0 ${
                    isCameraOn ? "border-cyan-400 text-cyan-400 bg-cyan-500/10" : ""
                  }`}
                  title={isCameraOn ? "Disable Camera" : "Enable Camera"}
                >
                  {isCameraOn ? <Video className="h-4 w-4 text-cyan-400" /> : <VideoOff className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  disabled={!isConnected}
                  onClick={handleInterrupt}
                  className="h-11 w-11 shrink-0 text-amber-500 hover:bg-amber-500/10 border-amber-500/30"
                  title="Interrupt AI Speech"
                >
                  <Square className="h-3.5 w-3.5 fill-amber-500" />
                </Button>
              </div>

              {/* Troubleshooting Prompt Chips */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  Quick Diagnostic Inquiries
                </span>
                <div className="flex flex-col gap-1.5">
                  {QUICK_PROMPTS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (!isConnected) {
                          connectLiveSession().then(() => {
                            setTimeout(() => sendTextMessage(item.prompt), 1000);
                          });
                        } else {
                          sendTextMessage(item.prompt);
                        }
                      }}
                      className={`w-full text-left rounded-md px-2.5 py-1.5 text-xs transition-colors border ${
                        item.alert
                          ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium"
                          : "border-border/70 bg-muted/30 text-foreground hover:bg-muted font-normal"
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Interaction & Diagnostic Log Feed */}
        <div
          className={`md:col-span-7 flex flex-col space-y-4 ${
            mobileTab === "feed" ? "flex" : "hidden md:flex"
          }`}
        >
          <Card className="border-border/80 bg-card shadow-xs flex flex-col h-[580px] sm:h-[640px]">
            {/* Feed Header */}
            <CardHeader className="p-3.5 pb-2.5 border-b border-border/60 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>Live Interaction &amp; Diagnostic Log</span>
              </CardTitle>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setMessages([
                    {
                      id: "cleared-" + Date.now(),
                      role: "system",
                      author: "SYSTEM",
                      text: "Diagnostic feed cleared.",
                      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    },
                  ])
                }
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear</span>
              </Button>
            </CardHeader>

            {/* Scrollable Feed Content */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {messages.map((msg) => {
                // SYSTEM MESSAGE
                if (msg.role === "system") {
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-2.5 text-xs leading-relaxed ${
                        msg.isError
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-border/60 bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                          SYSTEM
                        </span>
                        <span className="font-mono text-[10px] opacity-70">{msg.time}</span>
                      </div>
                      <div>{msg.text}</div>
                    </div>
                  );
                }

                // USER MESSAGE
                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex flex-col items-end space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{msg.author}</span>
                        <span>&bull;</span>
                        <span className="font-mono">{msg.time}</span>
                      </div>
                      <div className="rounded-xl rounded-tr-xs bg-cyan-500 text-slate-950 font-medium px-3.5 py-2 max-w-[85%] shadow-xs leading-relaxed">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                // AGENT MESSAGE
                if (msg.role === "agent") {
                  return (
                    <div key={msg.id} className="flex flex-col items-start space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400">
                          <Sparkles className="h-2.5 w-2.5" />
                        </div>
                        <span className="font-semibold text-cyan-400">{msg.author}</span>
                        <span>&bull;</span>
                        <span className="font-mono">{msg.time}</span>
                      </div>
                      <div className="rounded-xl rounded-tl-xs border border-border/80 bg-muted/40 text-foreground px-3.5 py-2.5 max-w-[90%] shadow-xs leading-relaxed space-y-1 whitespace-pre-wrap">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                // TOOL CALL
                if (msg.role === "tool_call") {
                  return (
                    <div
                      key={msg.id}
                      className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-2.5 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="cyan" className="text-[10px] py-0 px-1.5">
                            Executing Tool
                          </Badge>
                          <span className="font-mono font-semibold text-cyan-400">
                            {msg.author}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {msg.time}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate bg-background/50 p-1.5 rounded border border-border/40">
                        {JSON.stringify(msg.toolData || {})}
                      </div>
                    </div>
                  );
                }

                // TOOL RESPONSE (DECISIVE REDRESSAL / REFUND / ORDER LOOKUP)
                if (msg.role === "tool_response") {
                  const resp = msg.toolData;

                  // 1. REFUND SETTLED CARD
                  if (msg.author === "issue_order_refund_or_replacement" || resp?.refund_id) {
                    return (
                      <div
                        key={msg.id}
                        className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 p-3.5 space-y-2.5 text-xs shadow-md animate-in zoom-in-95 duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="refund" className="text-[11px] font-bold py-0.5 px-2">
                              Refund Authorized &amp; Settled
                            </Badge>
                          </div>
                          <span className="text-base font-extrabold font-mono text-amber-400">
                            {resp.refund_amount || "$499.00"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-background/80 p-2.5 border border-border/60 text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Refund ID</span>
                            <span className="font-mono font-bold text-foreground">
                              {resp.refund_id}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Order ID</span>
                            <span className="font-mono text-foreground">{resp.order_id}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Product</span>
                            <span className="font-medium text-foreground truncate block">
                              {resp.product_name || "Sit-Stand Desk"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Original Payment</span>
                            <span className="font-mono text-muted-foreground text-[10px] truncate block">
                              {resp.original_payment_id || "Captured Card"}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-md bg-amber-500/20 p-2 text-foreground text-[11px] leading-relaxed">
                          <strong>Resolution Notice:</strong> {resp.message}
                        </div>
                      </div>
                    );
                  }

                  // 2. TECHNICIAN ESCALATION CARD
                  if (msg.author === "escalate_to_human_technician" || resp?.ticket_id) {
                    return (
                      <div
                        key={msg.id}
                        className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <Wrench className="h-4 w-4 text-cyan-400" />
                            <span>Technician Dispatch Scheduled</span>
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-cyan-400">
                            {resp.ticket_id}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          {resp.message}
                        </p>
                      </div>
                    );
                  }

                  // 3. STEP BY STEP GUIDE
                  if (resp?.step_by_step_guide || resp?.actionable_steps) {
                    const steps = resp.step_by_step_guide || resp.actionable_steps || [];
                    return (
                      <div
                        key={msg.id}
                        className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-2 text-xs"
                      >
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{resp.component_name || "Diagnostic"} Step Guide</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1 leading-relaxed">
                          {steps.map((s: string, idx: number) => (
                            <li key={idx} className="text-foreground">
                              {s}
                            </li>
                          ))}
                        </ol>
                      </div>
                    );
                  }

                  // Standard Tool Output
                  return (
                    <div
                      key={msg.id}
                      className="rounded-lg border border-border/80 bg-muted/20 p-2.5 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-muted-foreground">
                          {msg.author} Output
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{msg.time}</span>
                      </div>
                      <pre className="font-mono text-[10px] text-muted-foreground overflow-x-auto bg-background/50 p-2 rounded border border-border/40">
                        {JSON.stringify(resp, null, 2)}
                      </pre>
                    </div>
                  );
                }

                return null;
              })}
              <div ref={feedEndRef} />
            </CardContent>

            {/* Input Bar */}
            <div className="p-3 border-t border-border/60 bg-muted/10 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendTextMessage(textInput);
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder={
                    isConnected
                      ? "Ask an issue, error code (e.g. rST), or inquiry..."
                      : "Connect live session to send queries..."
                  }
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={!isConnected}
                  className="h-9 text-xs bg-background"
                />
                <Button
                  type="submit"
                  disabled={!isConnected || !textInput.trim()}
                  className="h-9 gap-1.5 px-3 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Send</span>
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
