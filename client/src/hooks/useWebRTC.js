import { useState, useEffect, useRef } from 'react';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
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

    const ws = useRef(null);
    const pc = useRef(null);
    const currentTargetId = useRef(null);

    const localStreamRef = useRef(null);
    const myIdRef = useRef('');
    const iceCandidateQueue = useRef([]);
    const dataChannelRef = useRef(null);

    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

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
                setStatus(`Gelen Bağlantı Talebi: ${data.id}`);
                setIncomingConnection({ id: data.id, offer: data.offer });
            }
            else if (data.type === 'answer') {
                await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                setStatus('Bağlantı Kuruldu!');

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
        iceCandidateQueue.current = [];
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
        channel.onopen = () => console.log('Data channel açıldı');
        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (window.api && window.api.sendRemoteControl) {
                    window.api.sendRemoteControl(data);
                }
            } catch (error) {
                console.error("Data channel parse hatası:", error);
            }
        };
    };

    const createPeerConnection = () => {
        pc.current = new RTCPeerConnection(configuration);

        if (!dataChannelRef.current || dataChannelRef.current.readyState === 'closed') {
            dataChannelRef.current = pc.current.createDataChannel('control', { negotiated: true, id: 0 });
            setupDataChannel(dataChannelRef.current);
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.current.addTrack(track, localStreamRef.current);
            });
        }

        pc.current.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        pc.current.onicecandidate = (event) => {
            if (event.candidate) {
                ws.current.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    targetId: currentTargetId.current,
                    id: myIdRef.current
                }));
            }
        };

        pc.current.oniceconnectionstatechange = () => {
            console.log("ICE Bağlantı Durumu:", pc.current.iceConnectionState);
            if (pc.current.iceConnectionState === 'failed' || pc.current.iceConnectionState === 'disconnected') {
                setStatus('Bağlantı koptu veya NAT engeli aşılamadı (ICE Failed).');
                setTimeout(() => disconnect(), 3000);
            }
        };

        pc.current.onnegotiationneeded = async () => {
            try {
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

        if (!pc.current) {
            createPeerConnection();

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

    return {
        myId, status, connectToDevice, remoteStream, sendControlData,
        incomingConnection, acceptConnection, rejectConnection, disconnect,
        sessionRole
    };
}