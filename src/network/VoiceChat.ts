import type { PlayerSnapshot, TeamId } from '../../shared/types/game.ts';
import { socketClient } from '../network/SocketClient.ts';

export class VoiceChatManager {
  private stream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private getVoiceVolume: () => number;

  constructor(getVoiceVolume: () => number) {
    this.getVoiceVolume = getVoiceVolume;
  }

  public get isActive(): boolean {
    return this.stream !== null;
  }

  public async start(players: PlayerSnapshot[], localId: string, localTeam: TeamId): Promise<boolean> {
    if (this.stream) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.stream = stream;
      for (const p of players) {
        if (p.id !== localId && !p.isBot && (localTeam === 'none' || p.team === localTeam)) {
          await this.createPeer(p.id, true);
        }
      }
      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  public stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    for (const pc of this.peers.values()) {
      pc.close();
    }
    this.peers.clear();
  }

  public async handleSignal(fromId: string, rawSignal: unknown) {
    const sig = rawSignal as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    let pc = this.peers.get(fromId) ?? null;
    if (!pc && this.stream) {
      pc = await this.createPeer(fromId, false);
    }
    if (!pc) return;

    if (sig.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
      if (sig.sdp.type === 'offer') {
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        socketClient.send({ type: 'voice_signal', targetId: fromId, signal: { sdp: ans } });
      }
    } else if (sig.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
    }
  }

  private async createPeer(peerId: string, initiator: boolean): Promise<RTCPeerConnection | null> {
    if (!this.stream) return null;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.peers.set(peerId, pc);
    this.stream.getTracks().forEach((tr) => pc.addTrack(tr, this.stream!));

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socketClient.send({ type: 'voice_signal', targetId: peerId, signal: { candidate: ev.candidate } });
      }
    };
    pc.ontrack = (ev) => {
      const audio = new Audio();
      audio.srcObject = ev.streams[0];
      audio.volume = this.getVoiceVolume();
      audio.play().catch(() => {});
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketClient.send({ type: 'voice_signal', targetId: peerId, signal: { sdp: offer } });
    }
    return pc;
  }
}
