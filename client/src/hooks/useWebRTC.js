import { useState, useEffect, useRef } from 'react';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        // Halka açık ücretsiz TURN sunucusu (Symmetric NAT aşmak için hayati önem taşır)
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ]
};

export function useWebRTC() {
    const [myId, setMyId] = useState('');
    const [status, setStatus] = useState('Sunucu aranıyor...');
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Gelen bağlantı bildirimini tutar
    const [incomingConnection, setIncomingConnection] = useState(null);

    // Rol: 'viewer' (Bağlanan) | 'target' (Ekranını Paylaşan) | null
    const [sessionRole, setSessionRole] = useState(null);
    const sessionRoleRef = useRef(null);

    const ws = useRef(null);
    const pc = useRef(null);
    const currentTargetId = useRef(null);

    const localStreamRef = useRef(null);
    const myIdRef = useRef('');
    const iceCandidateQueue = useRef([]);
    const dataChannelRef = useRef(null);
    const incomingFile = useRef(null);

    const [fileTransferProgress, setFileTransferProgress] = useState(null);
    const [messages, setMessages] = useState([]);

    // Multi-Monitor state'leri
    const [remoteScreens, setRemoteScreens] = useState([]);
    const [activeScreenId, setActiveScreenId] = useState(null);

    const [videoQuality, setVideoQuality] = useState('Dengeli');
    const currentQualityRef = useRef('Dengeli');

    const reconnectAttemptsRef = useRef(0);

    const applyVideoQuality = async (quality, specificSender = null) => {
        let videoSender = specificSender;
        if (!videoSender && pc.current) {
            const senders = pc.current.getSenders();
            videoSender = senders.find(s => s.track && s.track.kind === 'video');
        }
        if (!videoSender) return;

        try {
            const parameters = videoSender.getParameters();
            if (!parameters.encodings || parameters.encodings.length === 0) {
                console.log("Henüz encodings oluşturulmamış, kalite ayarı bekletiliyor.");
                return;
            }

            if (quality === 'Yüksek') {
                parameters.encodings[0].maxBitrate = 5000000;
                parameters.encodings[0].scaleResolutionDownBy = 1;
                parameters.encodings[0].maxFramerate = 30;
            } else if (quality === 'Dengeli') {
                parameters.encodings[0].maxBitrate = 1500000;
                parameters.encodings[0].scaleResolutionDownBy = 1.5;
                parameters.encodings[0].maxFramerate = 20;
            } else if (quality === 'Düşük') {
                parameters.encodings[0].maxBitrate = 500000;
                parameters.encodings[0].scaleResolutionDownBy = 2.0;
                parameters.encodings[0].maxFramerate = 15;
            }
            await videoSender.setParameters(parameters);
            console.log(`Video kalitesi '${quality}' olarak güncellendi.`);
        } catch (e) {
            console.error("Kalite değiştirme hatası:", e);
        }
    };

    const switchQuality = (quality) => {
        setVideoQuality(quality);
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify({ type: 'change-quality', quality }));
        }
    };

    const handleReconnect = async () => {
        if (reconnectAttemptsRef.current >= 3) {
            alert('Bağlantı tamamen koptu ve yeniden bağlanılamadı.');
            resetConnection();
            return;
        }

        reconnectAttemptsRef.current += 1;
        setStatus(`Bağlantı koptu, ağ bekleniyor... (${reconnectAttemptsRef.current}/3)`);

        if (sessionRoleRef.current === 'viewer') {
            try {
                await new Promise(r => setTimeout(r, 2500));

                if (pc.current && pc.current.iceConnectionState === 'connected') {
                    reconnectAttemptsRef.current = 0;
                    setStatus('Bağlantı Kuruldu (Kurtarıldı)');
                    return;
                }

                const offer = await pc.current.createOffer({ iceRestart: true });
                await pc.current.setLocalDescription(offer);

                ws.current.send(JSON.stringify({
                    type: 'offer',
                    offer: offer,
                    targetId: currentTargetId.current,
                    id: myIdRef.current
                }));
            } catch (e) {
                console.error("Yeniden bağlanma hatası:", e);
                // Bir sonraki deneme için tetikle
                setTimeout(handleReconnect, 1000);
            }
        }
    };

    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

    // Clipboard Listener (Pano değişikliklerini takip edip karşı tarafa atar)
    useEffect(() => {
        if (window.api && window.api.onClipboardChanged) {
            window.api.onClipboardChanged((text) => {
                if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                    dataChannelRef.current.send(JSON.stringify({ type: 'clipboard', text }));
                }
            });
        }
    }, []);

    useEffect(() => {
        let id = localStorage.getItem('lan_remote_client_id');
        if (!id) {
            id = Math.floor(100000 + Math.random() * 900000).toString();
            localStorage.setItem('lan_remote_client_id', id);
        }
        setMyId(id);
        myIdRef.current = id;

        // VITE_WS_URL tanımlıysa onu kullan, yoksa buluttaki sunucuya bağlan
        const SIGNALING_SERVER_URL = import.meta.env.VITE_WS_URL || 'wss://lan-remote-2-0-backend.onrender.com';
        ws.current = new WebSocket(SIGNALING_SERVER_URL);

        ws.current.onopen = () => {
            setStatus('Sunucuya Bağlandı (Hazır)');
            ws.current.send(JSON.stringify({ type: 'register', id: id }));
        };

        ws.current.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'offer') {
                if (pc.current && pc.current.signalingState !== 'closed' && sessionRoleRef.current === 'target') {
                    // ICE Restart talebi geldi, sessiz sedasız answer döndür
                    setStatus(`Yeniden Bağlantı Talebi (ICE Kurtarma)`);
                    try {
                        await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                        const answer = await pc.current.createAnswer();
                        await pc.current.setLocalDescription(answer);

                        ws.current.send(JSON.stringify({
                            type: 'answer',
                            answer: answer,
                            targetId: data.id,
                            id: myIdRef.current
                        }));
                    } catch (e) {
                        console.error('ICE Restart Hatası:', e);
                    }
                } else {
                    setStatus(`Gelen Bağlantı Talebi: ${data.id}`);
                    setIncomingConnection({ id: data.id, offer: data.offer });
                }
            }
            else if (data.type === 'answer') {
                try {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    setStatus('Bağlantı Kuruldu! Medya bekleniyor...');
                    console.log("Answer alındı ve uygulandı.");
                } catch (e) {
                    console.error("Answer setRemoteDescription Hatası: ", e);
                    setStatus(`Hata (Answer): ${e.message}`);
                }

                while (iceCandidateQueue.current.length > 0) {
                    const cand = iceCandidateQueue.current.shift();
                    try {
                        await pc.current.addIceCandidate(new RTCIceCandidate(cand));
                    } catch (e) {
                        console.error("ICE ekleme hatası", e);
                    }
                }
            }
            else if (data.type === 'ice-candidate') {
                if (pc.current && pc.current.remoteDescription && pc.current.remoteDescription.type) {
                    try {
                        await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } catch (e) {
                        console.error("ICE ekleme hatası", e);
                    }
                } else {
                    iceCandidateQueue.current.push(data.candidate);
                }
            }
            else if (data.type === 'rejected') {
                setStatus('Bağlantı isteği reddedildi.');
                alert('Karşı taraf bağlantıyı reddetti.');
                resetConnection();
            }
            else if (data.type === 'disconnect') {
                setStatus('Bağlantı kesildi.');
                resetConnection();
            }
        };

        return () => {
            if (ws.current) ws.current.close();
            if (pc.current) pc.current.close();
        };
    }, []);

    // Bağlantıyı tamamen sıfırlar ve kapatır
    const resetConnection = () => {
        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }
        // Medya cihazlarının donanım bazlı kapatılması
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        setLocalStream(null);
        setRemoteStream(null);
        setIncomingConnection(null);
        setSessionRole(null);
        sessionRoleRef.current = null;
        iceCandidateQueue.current = [];
        setMessages([]); // Sohbeti temizle
        setStatus('Sistem Boşta / Hazır');
    };

    // Karşı tarafa 'disconnect' gönder ve bağlantıyı temizle
    const disconnect = () => {
        if (currentTargetId.current && ws.current) {
            ws.current.send(JSON.stringify({
                type: 'disconnect',
                targetId: currentTargetId.current,
                id: myIdRef.current
            }));
        }
        resetConnection();
    };

    // Onay modalında 'Kabul Et' basıldığında çalışır
    const acceptConnection = async () => {
        if (!incomingConnection) return;
        const { id, offer } = incomingConnection;

        currentTargetId.current = id;
        setStatus(`Bağlantı kabul edildi: ${id}`);
        setIncomingConnection(null);
        setSessionRole('target'); // Biz hedefiz, kontrolü veriyoruz
        sessionRoleRef.current = 'target';

        try {
            // Masaüstü ekranını yayına al
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            setLocalStream(stream);
            localStreamRef.current = stream; // Hemen tünele eklenebilmesi için

            if (!pc.current) {
                createPeerConnection();
            }

            await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);

            ws.current.send(JSON.stringify({
                type: 'answer',
                answer: answer,
                targetId: currentTargetId.current,
                id: myIdRef.current
            }));

            while (iceCandidateQueue.current.length > 0) {
                const cand = iceCandidateQueue.current.shift();
                try {
                    await pc.current.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                    console.error("ICE ekleme hatası", e);
                }
            }

            // Eğer ekran paylaşımı işletim sistemi üzerinden manuel kapatılırsa (örn. Stop Sharing'e basılırsa)
            stream.getVideoTracks()[0].onended = () => {
                disconnect();
            };
        } catch (err) {
            console.error("Kabul etme (accept) hatası:", err);
            alert("Ekran paylaşımına izin verilmediği için bağlantı başarısız.");
            disconnect();
        }
    };

    // Onay modalında 'Reddet' basıldığında çalışır
    const rejectConnection = () => {
        if (!incomingConnection) return;

        ws.current.send(JSON.stringify({
            type: 'rejected',
            targetId: incomingConnection.id,
            id: myIdRef.current
        }));

        setIncomingConnection(null);
        setStatus('Bağlantı isteği reddedildi (Hazır)');
    };

    const setupDataChannel = (channel) => {
        channel.binaryType = 'arraybuffer';
        channel.onopen = async () => {
            console.log('Data channel açıldı');
            if (sessionRoleRef.current === 'target') {
                if (window.api && window.api.getScreens) {
                    const screens = await window.api.getScreens();
                    channel.send(JSON.stringify({ type: 'screens-list', screens }));
                }
            }
        };
        channel.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const data = JSON.parse(event.data);
                    if (window.api && window.api.sendRemoteControl && data.type !== 'chat') {
                        window.api.sendRemoteControl(data);
                    }
                    if (data.type === 'chat') {
                        setMessages((prev) => [...prev, {
                            id: data.timestamp + Math.random(),
                            sender: data.sender,
                            text: data.text,
                            timestamp: data.timestamp,
                            isMe: false
                        }]);
                    } else if (data.type === 'screens-list') {
                        setRemoteScreens(data.screens);
                        if (data.screens && data.screens.length > 0) {
                            setActiveScreenId(data.screens[0].id);
                        }
                    } else if (data.type === 'clipboard') {
                        if (window.api && window.api.writeClipboard) {
                            window.api.writeClipboard(data.text);
                        }
                    } else if (data.type === 'change-quality' && sessionRoleRef.current === 'target') {
                        currentQualityRef.current = data.quality;
                        applyVideoQuality(data.quality);
                    } else if (data.type === 'switch-screen' && sessionRoleRef.current === 'target') {
                        if (window.api && window.api.setScreen) {
                            window.api.setScreen(data.screenId);
                            navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
                                .then(newStream => {
                                    const newVideoTrack = newStream.getVideoTracks()[0];
                                    const senders = pc.current.getSenders();
                                    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                                    if (videoSender) {
                                        videoSender.replaceTrack(newVideoTrack);
                                        applyVideoQuality(currentQualityRef.current, videoSender);
                                    }
                                    setLocalStream(newStream);
                                    if (localStreamRef.current) {
                                        localStreamRef.current.getTracks().forEach(t => t.stop());
                                    }
                                    localStreamRef.current = newStream;

                                    newVideoTrack.onended = () => {
                                        disconnect();
                                    };
                                }).catch(e => console.error(e));
                        }
                    } else if (data.type === 'file-start') {
                        incomingFile.current = {
                            name: data.name,
                            size: data.size,
                            mimeType: data.mimeType,
                            chunks: [],
                            received: 0
                        };
                        setFileTransferProgress(0);
                    } else if (data.type === 'file-end') {
                        if (incomingFile.current) {
                            const blob = new Blob(incomingFile.current.chunks, { type: incomingFile.current.mimeType });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = incomingFile.current.name;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            a.remove();
                            incomingFile.current = null;
                            setTimeout(() => setFileTransferProgress(null), 2000);
                        }
                    }
                } catch (error) {
                    console.error("Data channel parse hatası:", error);
                }
            } else {
                // Binary (Dosya parçaları)
                if (incomingFile.current) {
                    incomingFile.current.chunks.push(event.data);
                    incomingFile.current.received += event.data.byteLength;
                    const progress = Math.floor((incomingFile.current.received / incomingFile.current.size) * 100);
                    setFileTransferProgress(progress > 100 ? 100 : progress);
                }
            }
        };
    };

    const createPeerConnection = () => {
        pc.current = new RTCPeerConnection(configuration);

        // HEDEF (Target) CİHAZ İÇİN: Karşıdan (Viewer) gelen DataChannel bağlantısını dinle
        pc.current.ondatachannel = (event) => {
            console.log("Karşı taraftan in-band DataChannel geldi.");
            dataChannelRef.current = event.channel;
            setupDataChannel(dataChannelRef.current);
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                // Varsayılan kalite (Dengeli) ile bağlantı başlar, böylece sonradan setParameters yapmaya gerek kalmaz.
                const encodings = currentQualityRef.current === 'Yüksek'
                    ? [{ maxBitrate: 5000000, maxFramerate: 30, scaleResolutionDownBy: 1 }]
                    : currentQualityRef.current === 'Düşük'
                        ? [{ maxBitrate: 500000, maxFramerate: 15, scaleResolutionDownBy: 2.0 }]
                        : [{ maxBitrate: 1500000, maxFramerate: 20, scaleResolutionDownBy: 1.5 }]; // Dengeli

                pc.current.addTransceiver(track, {
                    direction: 'sendonly',
                    streams: [localStreamRef.current],
                    sendEncodings: encodings
                });
            });
        }

        pc.current.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            } else {
                setRemoteStream(new MediaStream([event.track]));
            }
        };

        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[ICE] Aday bulundu: ${event.candidate.candidate}`);
                ws.current.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    targetId: currentTargetId.current,
                    id: myIdRef.current
                }));
            } else {
                console.log("[ICE] Aday toplama süreci tamamlandı.");
            }
        };

        pc.current.oniceconnectionstatechange = () => {
            const state = pc.current.iceConnectionState;
            console.log("ICE Bağlantı Durumu:", state);
            if (state === 'failed' || state === 'disconnected') {
                handleReconnect();
            } else if (state === 'connected') {
                reconnectAttemptsRef.current = 0;
                setStatus('Bağlantı Kuruldu (Aktif Seans)');
            }
        };

        pc.current.onnegotiationneeded = async () => {
            try {
                // SADECE VIEWER TEKLİF (OFFER) OLUŞTURABİLİR! Target teklif oluşturmamalı.
                if (sessionRoleRef.current === 'target') return;

                if (pc.current.signalingState !== 'stable') return;

                const offer = await pc.current.createOffer();
                await pc.current.setLocalDescription(offer);

                ws.current.send(JSON.stringify({
                    type: 'offer',
                    offer: pc.current.localDescription,
                    targetId: currentTargetId.current,
                    id: myIdRef.current
                }));
            } catch (err) {
                console.error("Müzakere (Negotiation) hatası:", err);
            }
        };
    };

    const connectToDevice = async (targetId) => {
        if (!targetId || targetId.length !== 6) return alert('Geçersiz ID');
        if (targetId === myIdRef.current) return alert('Kendinize bağlanamazsınız!');

        setStatus(`Bağlanılıyor: ${targetId}...`);
        currentTargetId.current = targetId;
        setSessionRole('viewer'); // Biz bağlanan kişiyiz, Viewer (izleyici)
        sessionRoleRef.current = 'viewer';

        if (!pc.current) {
            createPeerConnection();

            // İZLEYİCİ (Viewer) İÇİN: Bağlantıyı kuran taraf olarak in-band DataChannel oluştur.
            dataChannelRef.current = pc.current.createDataChannel('control');
            setupDataChannel(dataChannelRef.current);

            if (!localStreamRef.current) {
                pc.current.addTransceiver('video', { direction: 'recvonly' });
            }
        }
    };

    const sendControlData = (data) => {
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify(data));
        }
    };

    const sendFile = (file) => {
        if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
            return alert('Veri kanalı henüz açılmadı. Lütfen bağlantının stabil olmasını bekleyin.');
        }

        const CHUNK_SIZE = 16384;

        setFileTransferProgress(0);

        dataChannelRef.current.send(JSON.stringify({
            type: 'file-start',
            name: file.name,
            size: file.size,
            mimeType: file.type
        }));

        let offset = 0;

        const readSlice = (o) => {
            const slice = file.slice(o, o + CHUNK_SIZE);
            const reader = new FileReader();

            reader.onload = (e) => {
                if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
                    setFileTransferProgress(null);
                    return alert('Gönderim sırasında bağlantı koptu.');
                }

                dataChannelRef.current.send(e.target.result);
                offset += CHUNK_SIZE;

                const progress = Math.floor((offset / file.size) * 100);
                if (progress <= 100) setFileTransferProgress(progress);

                if (offset < file.size) {
                    // Buffer kontrolü (Backpressure yönetimi)
                    if (dataChannelRef.current.bufferedAmount > 65535) {
                        setTimeout(() => readSlice(offset), 50);
                    } else {
                        readSlice(offset);
                    }
                } else {
                    dataChannelRef.current.send(JSON.stringify({ type: 'file-end' }));
                    setTimeout(() => setFileTransferProgress(null), 2000);
                }
            };

            reader.readAsArrayBuffer(slice);
        };

        readSlice(0);
    };

    const sendChatMessage = (text, senderName = 'Cihaz') => {
        if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
            return false;
        }

        const msgObj = {
            type: 'chat',
            text: text,
            sender: senderName,
            timestamp: Date.now()
        };

        try {
            dataChannelRef.current.send(JSON.stringify(msgObj));
            setMessages((prev) => [...prev, {
                id: msgObj.timestamp + Math.random(),
                sender: 'Siz',
                text: text,
                timestamp: msgObj.timestamp,
                isMe: true
            }]);
            return true;
        } catch (e) {
            console.error("Mesaj gönderilemedi:", e);
            return false;
        }
    };

    const switchMonitor = (id) => {
        setActiveScreenId(id);
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify({ type: 'switch-screen', screenId: id }));
        }
    };

    return {
        myId, status, connectToDevice, remoteStream, sendControlData,
        incomingConnection, acceptConnection, rejectConnection, disconnect,
        sessionRole, sendFile, fileTransferProgress,
        messages, sendChatMessage,
        remoteScreens, activeScreenId, switchMonitor
    };
}