import React, { useState, useEffect, useRef } from 'react';
import AddressBook from './components/AddressBook';
import { useWebRTC } from './hooks/useWebRTC';
import { Radio, ArrowRight, Folder, MessageSquare, Circle, Maximize, Minimize, X, ShieldAlert, Check, MonitorUp, Activity, Monitor } from 'lucide-react';

function App() {
  const {
    myId, status, connectToDevice, remoteStream, sendControlData,
    incomingConnection, acceptConnection, rejectConnection, disconnect,
    sessionRole, sendFile, fileTransferProgress,
    messages, sendChatMessage,
    remoteScreens, activeScreenId, switchMonitor
  } = useWebRTC();

  // Toolbar state'leri
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (!showChat && messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg.isMe) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHasUnreadMessages(true);
      }
    }
  }, [messages, showChat]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showChat) setHasUnreadMessages(false);
  }, [showChat]);

  const [targetInput, setTargetInput] = useState('');
  const remoteVideoRef = useRef(null);
  const viewerWrapperRef = useRef(null);

  const fileInputRef = useRef(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Wrapper function to save recent connections
  const handleConnectWithHistory = (id) => {
    if (id && id.length === 6) {
      const recent = JSON.parse(localStorage.getItem('lan_remote_recent_connections') || '[]');
      const existingIdx = recent.findIndex(r => r.id === id);
      if (existingIdx !== -1) {
        recent.splice(existingIdx, 1);
      }
      recent.unshift({ id: id, timestamp: Date.now() });
      if (recent.length > 5) {
        recent.pop();
      }
      localStorage.setItem('lan_remote_recent_connections', JSON.stringify(recent));
      window.dispatchEvent(new Event('recentConnectionsUpdated'));

      connectToDevice(id);
    }
  };

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Klavye olaylarını dinle ve karşı tarafa gönder
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (sessionRole === 'viewer' && sendControlData) {
        sendControlData({ type: 'keydown', key: e.key });
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sessionRole, sendControlData]);

  // Tam ekran değişimi algılayıcı
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fare hareketlerini hesapla ve gönder
  const handleMouseMove = (e) => {
    if (sessionRole !== 'viewer' || !remoteVideoRef.current || !sendControlData) return;

    const rect = remoteVideoRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      sendControlData({ type: 'mousemove', x, y });
    }
  };

  const handleMouseClick = (e) => {
    if (sessionRole !== 'viewer' || !remoteVideoRef.current || !sendControlData) return;
    sendControlData({ type: 'click' });
  };

  // Tam Ekran Kontrolü
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const elem = viewerWrapperRef.current || document.documentElement;
      elem.requestFullscreen().catch(err => console.log(err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  // Ekran Kaydı Kontrolü (MediaRecorder API)
  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      if (!remoteStream) return;
      chunksRef.current = [];
      try {
        const mediaRecorder = new MediaRecorder(remoteStream, { mimeType: 'video/webm' });

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.style.display = 'none';
          a.href = url;
          a.download = `lan-remote-kayit-${new Date().getTime()}.webm`;
          a.click();
          window.URL.revokeObjectURL(url);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        alert("Ekran kaydı bu cihazda desteklenmiyor veya codec hatası oluştu.");
        console.error(err);
      }
    }
  };

  // Güvenli Bağlantı Kesme (Ekran kaydı açıksa önce onu kapat)
  const handleDisconnect = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
    // UI Reset
    setShowChat(false);
    setIsDraggingFile(false);

    disconnect();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      {/* Top Bar (Sadece Dashboard da görünür) */}
      {!isFullscreen && sessionRole !== 'viewer' && (
        <div className="bg-zinc-900 border-b border-border text-foreground px-6 py-4 flex justify-between items-center shadow-sm">
          <h2 className="m-0 flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-100">
            <Radio className="w-5 h-5 text-primary" /> LAN Remote
          </h2>
          <span className="text-xs bg-zinc-800 border border-border px-3 py-1 rounded-full text-zinc-400 flex items-center gap-2">
            <Activity className="w-3 h-3 text-primary animate-pulse" /> {status}
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 relative ${isFullscreen || sessionRole === 'viewer' ? 'p-0' : 'p-8'}`}>

        {/* GÖRÜNÜM 1: Dashboard */}
        {!sessionRole && (
          <React.Fragment>
            <div className="flex gap-8 justify-center mt-12 flex-wrap">

              {/* Sol Panel: Kendi Cihazım */}
              <div className="bg-zinc-900 border border-border rounded-xl p-8 flex-1 w-full max-w-sm flex flex-col items-center shadow-xl">
                <h3 className="m-0 mb-2 text-lg font-semibold text-zinc-100">Bu Çalışma Alanı</h3>
                <p className="text-zinc-500 text-sm text-center mb-8 leading-relaxed">
                  Başka bir cihazın size bağlanabilmesi için kodunuzu paylaşın.
                </p>
                <div className="text-4xl tracking-[0.25em] font-bold text-primary mb-4 p-4 bg-zinc-800 rounded-lg border border-border w-full text-center">
                  {myId || '------'}
                </div>
              </div>

              {/* Sağ Panel: Uzak Cihaza Bağlan */}
              <div className="bg-zinc-900 border border-border rounded-xl p-8 flex-1 w-full max-w-sm flex flex-col items-center shadow-xl">
                <h3 className="m-0 mb-2 text-lg font-semibold text-zinc-100">Uzak Masaüstüne Bağlan</h3>
                <p className="text-zinc-500 text-sm text-center mb-6 leading-relaxed">
                  Erişmek istediğiniz cihazın 6 haneli kodunu girerek bağlantı isteği gönderin.
                </p>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="Hedef ID"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full p-3 text-2xl tracking-[0.25em] text-center rounded-md border border-border bg-zinc-800 text-zinc-100 mb-6 focus:outline-none focus:border-primary transition-colors placeholder:text-zinc-700"
                />
                <button
                  onClick={() => handleConnectWithHistory(targetInput)}
                  className="w-full p-2.5 bg-primary hover:bg-primary/90 text-primary-foreground border-none rounded-md font-semibold cursor-pointer text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                  disabled={targetInput.length !== 6}
                >
                  <ArrowRight className="w-4 h-4" /> BAĞLAN
                </button>
              </div>
            </div>

            {/* Adres Defteri - Address Book */}
            {!sessionRole && <AddressBook onConnect={handleConnectWithHistory} />}

          </React.Fragment>
        )}

        {/* GÖRÜNÜM 2: Uzak Ekran (İzleyici - Viewer Seansı) */}
        {sessionRole === 'viewer' && (
          <div
            ref={viewerWrapperRef}
            className={`w-full h-full bg-zinc-950 flex flex-col ${isFullscreen ? 'z-[9999]' : 'z-10'}`}
          >
            {/* Viewer Header / Toolbar (Ultra Slim) */}
            <div className="bg-zinc-900 px-4 py-1.5 flex justify-between items-center border-b border-border z-10">
              {/* Sol Taraf: Logo ve Durum */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> LAN Remote
                </span>
                <div className="bg-green-950/30 text-green-500 border border-green-900/50 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5 tracking-wide">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> AKTİF SEANS
                </div>
              </div>

              {/* Sağ Taraf: Toolbar İşlevleri */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleFullscreen}
                  title="Tam Ekran"
                  className="bg-transparent hover:bg-zinc-800 text-zinc-400 border border-transparent hover:border-border px-2.5 py-1 rounded cursor-pointer flex items-center gap-1.5 transition-colors text-xs font-medium"
                >
                  {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                  <span>{isFullscreen ? 'Daralt' : 'Tam Ekran'}</span>
                </button>

                {remoteScreens && remoteScreens.length > 1 && (
                  <>
                    <div className="w-px h-4 bg-border mx-1"></div>
                    <div className="flex items-center gap-1.5 bg-zinc-950/50 rounded px-2 py-0.5 border border-border">
                      <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                      <select
                        value={activeScreenId || ''}
                        onChange={(e) => switchMonitor(e.target.value)}
                        className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer w-24 truncate"
                      >
                        {remoteScreens.map(screen => (
                          <option key={screen.id} value={screen.id} className="bg-zinc-900 text-sm">
                            {screen.name || 'Menü'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="w-px h-4 bg-border mx-1"></div>

                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      sendFile(file);
                    }
                    e.target.value = null;
                  }}
                />
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowChat(false); }}
                  title="Dosya Gönder"
                  className="bg-transparent hover:bg-zinc-800 text-zinc-400 border border-transparent hover:border-border px-2.5 py-1 rounded cursor-pointer flex items-center gap-1.5 transition-colors text-xs font-medium"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Dosya</span>
                </button>

                <button
                  onClick={() => setShowChat(!showChat)}
                  title="Sohbet"
                  className={`${showChat ? 'bg-primary/20 text-primary border-primary/30' : 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800 hover:border-border'} relative px-2.5 py-1 rounded cursor-pointer border flex items-center gap-1.5 transition-colors text-xs font-medium`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Sohbet</span>
                  {hasUnreadMessages && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  )}
                </button>

                <button
                  onClick={toggleRecording}
                  title="Ekran Kaydı"
                  className={`${isRecording ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800 hover:border-border'} px-2.5 py-1 rounded cursor-pointer border flex items-center gap-1.5 transition-colors text-xs font-medium`}
                >
                  <Circle className={`w-3.5 h-3.5 ${isRecording ? 'fill-red-500 text-red-500 animate-pulse' : ''}`} />
                  <span>Kayıt</span>
                </button>

                <div className="w-px h-4 bg-border mx-1"></div>

                <button
                  onClick={handleDisconnect}
                  title="Bağlantıyı Kes"
                  className="bg-destructive/20 hover:bg-destructive text-red-400 hover:text-white border border-transparent hover:border-red-600 px-3 py-1 rounded cursor-pointer flex items-center gap-1.5 transition-colors text-xs font-semibold"
                >
                  <X className="w-3.5 h-3.5" /> KES
                </button>
              </div>
            </div>

            {/* Video Container & Drag/Drop Area */}
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDragLeave={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const file = e.dataTransfer.files[0];
                  sendFile(file);
                }
              }}
              className="flex-1 min-h-0 bg-zinc-950 relative flex justify-center items-center"
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                onMouseMove={handleMouseMove}
                onClick={handleMouseClick}
                className="w-full h-full object-contain cursor-crosshair transition-[filter] duration-300"
                style={{ filter: (showChat || isDraggingFile) ? 'brightness(0.3)' : 'none' }}
              />

              {/* BEKLEME (LOADING) EKRANI */}
              {!remoteStream && sessionRole === 'viewer' && (
                <div className="absolute inset-0 flex flex-col justify-center items-center bg-zinc-900 z-10 w-full px-8 text-center gap-6">
                  {status.includes('Hata') || status.includes('Engeli') || status.includes('koptu') || status.includes('Failed') ? (
                    <div className="flex flex-col items-center">
                      <X className="w-12 h-12 text-red-500/80 mb-4" />
                      <button
                        onClick={() => { disconnect(); handleConnectWithHistory(targetInput); }}
                        className="mt-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 px-4 py-2 rounded-md font-semibold text-sm transition-all"
                      >
                        Yeniden Dene
                      </button>
                      <button
                        onClick={disconnect}
                        className="mt-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-md text-sm transition-all"
                      >
                        İptal Et ve Geri Dön
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full border-[3px] border-white/5 border-t-primary animate-spin"></div>
                  )}
                  <p className="text-zinc-400 text-sm tracking-wide break-words max-w-md mt-4">
                    {status.includes('Hata') || status.includes('Engeli') || status.includes('koptu') || status.includes('Failed')
                      ? <span className="text-red-400 font-semibold">{status}</span>
                      : (status === 'Bağlantı Kuruldu! Medya bekleniyor...' ? status : 'Karşı tarafın onayı bekleniyor...\n' + status)}
                  </p>
                </div>
              )}

              {/* DOSYA AKTARIM BİLDİRİMİ (PROGRESS OSD) */}
              {fileTransferProgress !== null && (
                <div className="absolute top-20 right-6 bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-2xl p-4 w-64 z-[999] animate-in slide-in-from-right-8 fade-in duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5"><Folder className="w-3.5 h-3.5 text-primary" /> Dosya Transferi</span>
                    <span className="text-xs font-mono text-zinc-400">{fileTransferProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${fileTransferProgress}%` }}></div>
                  </div>
                </div>
              )}

              {/* SOHBET MODALI (Drawer) */}
              {showChat && (
                <div className="absolute top-5 right-6 w-80 h-[80%] max-h-[450px] bg-zinc-900/80 backdrop-blur-xl rounded-xl border border-white/10 z-20 flex flex-col overflow-hidden shadow-2xl">
                  <div className="p-4 border-b border-white/10 text-zinc-100 font-semibold flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Ağ Sohbeti</span>
                    <button onClick={() => setShowChat(false)} className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none p-1 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 custom-scrollbar bg-zinc-950/50">
                    {messages && messages.length > 0 ? (
                      messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                          <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed shadow-sm break-words ${msg.isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-zinc-500 mt-1 px-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs opacity-60">
                        <MessageSquare className="w-8 h-8 mb-3 opacity-30" />
                        Sohbet geçmişi boş...
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-3 border-t border-white/10 bg-zinc-900/90 flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-zinc-950 border border-border rounded-full px-4 text-sm text-zinc-200 focus:outline-none focus:border-primary/50 transition-colors"
                      placeholder="Mesaj yazın..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && chatInput.trim()) {
                          sendChatMessage(chatInput.trim(), 'İzleyici');
                          setChatInput('');
                        }
                      }}
                    />
                    <button
                      className="w-8 h-8 bg-primary hover:bg-primary/90 text-white rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
                      disabled={!chatInput.trim()}
                      onClick={() => {
                        sendChatMessage(chatInput.trim(), 'İzleyici');
                        setChatInput('');
                      }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* DRAG & DROP OVERLAY */}
              {isDraggingFile && (
                <div
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const file = e.dataTransfer.files[0];
                      sendFile(file);
                    }
                  }}
                  className="absolute inset-x-4 inset-y-4 bg-zinc-900/80 backdrop-blur-md z-50 flex flex-col justify-center items-center border-[3px] border-dashed border-white/20 rounded-2xl"
                >
                  <Folder className="w-16 h-16 text-primary mb-6 animate-bounce" />
                  <h2 className="text-zinc-100 m-0 text-2xl font-bold tracking-tight">Dosyayı Bırakın</h2>
                  <p className="text-zinc-400 mt-3 text-sm">Peer-to-Peer doğrudan güvenli veri transferi</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GÖRÜNÜM 3: Ekran Paylaşan (Hedef - Target Seansı) */}
        {sessionRole === 'target' && (
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="bg-zinc-900 border border-border p-10 rounded-xl text-center max-w-[450px] w-full shadow-2xl z-10 transition-all">
              <MonitorUp className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="m-0 mb-4 text-zinc-100 text-xl font-bold">Masaüstünüz Paylaşılıyor</h3>
              <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
                Şu anda cihazınız uzak bir kullanıcı tarafından görüntüleniyor.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-all border ${showChat ? 'bg-primary/20 text-primary border-primary/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-border'}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Sohbeti {showChat ? 'Kapat' : 'Aç'}
                  {hasUnreadMessages && !showChat && (
                    <span className="flex h-2.5 w-2.5 ml-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  )}
                </button>
                <button
                  onClick={disconnect}
                  className="w-full relative group overflow-hidden rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold py-3 border border-red-500/20 transition-all active:scale-95"
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    Paylaşımı Durdur
                  </div>
                </button>
              </div>
            </div>

            {/* SOHBET MODALI (Drawer) - TARGET İÇİN */}
            {showChat && (
              <div className="absolute top-5 right-6 w-80 h-[80%] max-h-[450px] bg-zinc-900/90 backdrop-blur-xl rounded-xl border border-white/10 z-20 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right-8 fade-in">
                <div className="p-4 border-b border-white/10 text-zinc-100 font-semibold flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Ağ Sohbeti</span>
                  <button onClick={() => setShowChat(false)} className="text-zinc-500 hover:text-zinc-300 bg-transparent border-none p-1 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 custom-scrollbar bg-zinc-950/50">
                  {messages && messages.length > 0 ? (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                        <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed shadow-sm break-words ${msg.isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs opacity-60">
                      <MessageSquare className="w-8 h-8 mb-3 opacity-30" />
                      Sohbet geçmişi boş...
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t border-white/10 bg-zinc-900/90 flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-zinc-950 border border-border rounded-full px-4 text-sm text-zinc-200 focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="Mesaj yazın..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && chatInput.trim()) {
                        sendChatMessage(chatInput.trim(), 'Hedef Cihaz');
                        setChatInput('');
                      }
                    }}
                  />
                  <button
                    className="w-8 h-8 bg-primary hover:bg-primary/90 text-white rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
                    disabled={!chatInput.trim()}
                    onClick={() => {
                      sendChatMessage(chatInput.trim(), 'Hedef Cihaz');
                      setChatInput('');
                    }}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ONAY MODALI (Gelen Bağlantı Overlay) */}
        {incomingConnection && !sessionRole && (
          <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex justify-center items-center z-[1000] p-4">
            <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md text-center border border-border shadow-2xl">
              <ShieldAlert className="w-16 h-16 text-primary mx-auto mb-6 drop-shadow-[0_0_15px_rgba(204,41,43,0.5)]" />
              <h2 className="m-0 mb-4 text-zinc-100 text-xl font-bold tracking-tight">Bağlantı Talebi</h2>

              <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                <strong className="text-2xl text-primary block mb-2 font-mono tracking-widest">{incomingConnection.id}</strong>
                kimlikli cihaz bilgisayarınızı kontrol etmek istiyor. Onaylıyor musunuz?
              </p>

              <div className="flex gap-4">
                <button
                  onClick={rejectConnection}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-800 text-zinc-300 border border-border rounded-lg cursor-pointer font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> Reddet
                </button>
                <button
                  onClick={acceptConnection}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-primary-foreground border-none rounded-lg cursor-pointer font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  <Check className="w-4 h-4" /> Kabul Et
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;