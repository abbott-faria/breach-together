import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, addDoc, collection, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_4CLZMLNn5ymIe5y64pAtQ4Kz7ZJhp8Y",
  authDomain: "don-t-leave-me-alone.firebaseapp.com",
  projectId: "don-t-leave-me-alone",
  storageBucket: "don-t-leave-me-alone.firebasestorage.app",
  messagingSenderId: "74557251120",
  appId: "1:74557251120:web:72f4b31d2698ec38b597f5"
};

export class NetworkManager {
  constructor(onConnectCallback, onMessageCallback) {
    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
    this.rtcConfig = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };
    
    this.peerConnection = null;
    this.dataChannel = null;
    this.isHost = false;
    this.connected = false;

    this.onConnect = onConnectCallback;
    this.onMessage = onMessageCallback;
    this.statusText = document.getElementById('status');
  }

  setupChannelHandlers() {
    this.dataChannel.onopen = () => {
      this.connected = true;
      this.statusText.textContent = `SYS // CHANNEL ACTIVE [${this.isHost ? 'HOST' : 'CLIENT'}]`;
      this.statusText.style.color = "#33ff33";
      this.onConnect(this.isHost);
    };

    this.dataChannel.onmessage = e => this.onMessage(JSON.parse(e.data));
    this.dataChannel.onclose = () => {
      this.statusText.textContent = "SYS // DISCONNECTED.";
      this.statusText.style.color = "#ff4444";
      this.connected = false;
    };
  }

  async hostLobby() {
    this.isHost = true;
    this.statusText.textContent = "SYS // CONFIGURING WEB_RTC...";
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.dataChannel = this.peerConnection.createDataChannel('game-payload', { ordered: false, maxRetransmits: 0 });
    this.setupChannelHandlers();

    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomDoc = doc(this.db, 'rooms', roomId);
    const candidatesCol = collection(roomDoc, 'candidates');

    this.peerConnection.addEventListener('icecandidate', e => {
      if (e.candidate) addDoc(candidatesCol, { ...e.candidate.toJSON(), type: 'host' });
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await setDoc(roomDoc, { offer: { type: offer.type, sdp: offer.sdp } });

    document.getElementById('interface').innerHTML = `<h3>ROOM ID: <span style="color:#ffcc44">${roomId}</span></h3><div id="status">SYS // OPEN_LINK_WAITING...</div>`;
    this.statusText = document.getElementById('status');

    onSnapshot(roomDoc, snapshot => {
      const data = snapshot.data();
      if (!this.peerConnection.currentRemoteDescription && data?.answer) {
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    onSnapshot(candidatesCol, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.type === 'client') this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  }

  async joinLobby(roomId) {
    this.isHost = false;
    this.statusText.textContent = "SYS // HANDSHAKING REMOTE SIGNAL...";

    const roomDoc = doc(this.db, 'rooms', roomId);
    const candidatesCol = collection(roomDoc, 'candidates');
    const roomSnapshot = await getDoc(roomDoc);

    if (!roomSnapshot.exists()) return alert("ROOM NOT FOUND");

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.peerConnection.addEventListener('datachannel', e => {
      this.dataChannel = e.channel;
      this.setupChannelHandlers();
    });

    this.peerConnection.addEventListener('icecandidate', e => {
      if (e.candidate) addDoc(candidatesCol, { ...e.candidate.toJSON(), type: 'client' });
    });

    const roomData = roomSnapshot.data();
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(roomData.offer));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    await setDoc(roomDoc, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

    onSnapshot(candidatesCol, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.type === 'host') this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  }

  send(data) {
    if (this.connected && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(data));
    }
  }
}