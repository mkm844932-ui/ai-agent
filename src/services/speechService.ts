export type SpeechStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface SpeechCallbacks {
  onStatusChange?: (status: SpeechStatus) => void;
  onTranscriptPartial?: (text: string) => void;
  onTranscriptFinal?: (text: string) => void;
  onAudioVolume?: (volume: number) => void; // 0.0 to 1.0 for lip sync
  onError?: (err: string) => void;
}

class SpeechService {
  private recognition: any = null;
  private synth: SpeechSynthesis | null = null;
  private isListening = false;
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private animationFrameId: number | null = null;
  private voiceRate = 1.0;
  private voicePitch = 1.0;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private callbacks: SpeechCallbacks = {};

  constructor() {
    if (typeof window !== 'undefined') {
      // Speech Synthesis Setup
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.initVoice();
      }

      // Speech Recognition Setup
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          this.isListening = true;
          this.callbacks.onStatusChange?.('listening');
        };

        this.recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          if (interim) {
            this.callbacks.onTranscriptPartial?.(interim);
          }
          if (final) {
            this.callbacks.onTranscriptFinal?.(final);
            this.stopListening();
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          this.isListening = false;
          this.callbacks.onStatusChange?.('idle');
          if (event.error !== 'no-speech') {
            this.callbacks.onError?.(`Speech Recognition error: ${event.error}`);
          }
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (!this.isSpeaking) {
            this.callbacks.onStatusChange?.('idle');
          }
        };
      }
    }
  }

  public setCallbacks(callbacks: SpeechCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private initVoice() {
    if (!this.synth) return;

    const loadVoices = () => {
      const voices = this.synth?.getVoices() || [];
      // Prefer friendly English teacher voices (Google US English, Natural, Microsoft Zira, etc.)
      const preferredVoice = voices.find(v => 
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Karen')) && v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

      if (preferredVoice) {
        this.selectedVoice = preferredVoice;
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices().filter(v => v.lang.startsWith('en'));
  }

  public setVoice(voice: SpeechSynthesisVoice) {
    this.selectedVoice = voice;
  }

  public setVoiceSettings(rate: number, pitch: number) {
    this.voiceRate = rate;
    this.voicePitch = pitch;
  }

  public startListening() {
    this.stopSpeaking(); // Voice interruption capability!

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('Speech recognition restart:', e);
      }
    } else {
      this.callbacks.onError?.('Speech Recognition is not supported in this browser. Please use Chrome/Edge or type your question.');
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
  }

  public speak(text: string, onEnd?: () => void) {
    if (!this.synth) return;

    // Interrupt any ongoing speech immediately
    this.stopSpeaking();

    const cleanText = text.replace(/[*_#`~]/g, ''); // Strip markdown syntax for natural reading
    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = this.voiceRate;
    utterance.pitch = this.voicePitch;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.callbacks.onStatusChange?.('speaking');
      this.simulateLipSyncVolume();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.stopLipSyncSim();
      this.callbacks.onStatusChange?.('idle');
      this.callbacks.onAudioVolume?.(0);
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      this.isSpeaking = false;
      this.stopLipSyncSim();
      this.callbacks.onStatusChange?.('idle');
      this.callbacks.onAudioVolume?.(0);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public stopSpeaking() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    this.stopLipSyncSim();
    this.callbacks.onAudioVolume?.(0);
    if (!this.isListening) {
      this.callbacks.onStatusChange?.('idle');
    }
  }

  /**
   * Simulates active audio volume levels during TTS playback to drive dynamic lip sync and head movements
   */
  private simulateLipSyncVolume() {
    this.stopLipSyncSim();
    let tick = 0;

    const animate = () => {
      if (!this.isSpeaking) return;
      tick += 0.15;
      // Generate natural mouth opening waveform during speaking
      const volume = (Math.sin(tick * 3) * 0.4 + Math.cos(tick * 7) * 0.3 + 0.3) * (Math.random() * 0.4 + 0.6);
      this.callbacks.onAudioVolume?.(Math.max(0.1, Math.min(1.0, volume)));
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopLipSyncSim() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

export const speechService = new SpeechService();
