import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface SpeechCaptionResult {
    text: string;
    isFinal: boolean;
    language: 'vi-VN' | 'en-US';
}

// Interface định nghĩa tối thiểu cho SpeechRecognition API
interface IWindowSpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: IWindowSpeechRecognition, ev: Event) => void) | null;
    onresult: ((this: IWindowSpeechRecognition, ev: any) => void) | null;
    onerror: ((this: IWindowSpeechRecognition, ev: any) => void) | null;
    onend: ((this: IWindowSpeechRecognition, ev: Event) => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition?: new () => IWindowSpeechRecognition;
        webkitSpeechRecognition?: new () => IWindowSpeechRecognition;
    }
}

/**
 * Phụ đề bằng Web Speech API (Chrome/Edge). Lấy lại logic từ FE/src/app/core/services/speech-recognition.service.ts:
 * tự khởi động lại khi trình duyệt ngắt phiên nhận dạng, trả kết quả tạm (interim) và kết quả cuối (final).
 */
@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
    readonly isSupported = signal<boolean>(false);
    readonly isListening = signal<boolean>(false);
    readonly currentLanguage = signal<'vi-VN' | 'en-US'>('vi-VN');
    readonly errorMessage = signal<string | null>(null);

    readonly captionResult = new Subject<SpeechCaptionResult>();

    private recognition: IWindowSpeechRecognition | null = null;
    private shouldKeepListening = false;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.checkSupport();
    }

    private checkSupport(): void {
        if (typeof window !== 'undefined') {
            const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.isSupported.set(!!SpeechClass);
        }
    }

    startListening(lang: 'vi-VN' | 'en-US' = this.currentLanguage()): void {
        this.currentLanguage.set(lang);
        this.shouldKeepListening = true;
        this.errorMessage.set(null);

        if (!this.isSupported()) {
            this.errorMessage.set('Trình duyệt không hỗ trợ nhận diện giọng nói (Web Speech API).');
            return;
        }

        this.initRecognition();
    }

    setLanguage(lang: 'vi-VN' | 'en-US'): void {
        if (this.currentLanguage() === lang) return;
        this.currentLanguage.set(lang);
        if (this.shouldKeepListening && this.recognition) {
            // Restart với ngôn ngữ mới
            this.stopRecognitionInstance();
            this.initRecognition();
        }
    }

    stopListening(): void {
        this.shouldKeepListening = false;
        this.clearRestartTimer();
        this.stopRecognitionInstance();
        this.isListening.set(false);
    }

    private initRecognition(): void {
        this.clearRestartTimer();
        this.stopRecognitionInstance();

        try {
            const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechClass) return;

            const instance = new SpeechClass();
            instance.continuous = true;
            instance.interimResults = true;
            instance.maxAlternatives = 1;
            instance.lang = this.currentLanguage();

            instance.onstart = () => {
                this.isListening.set(true);
                this.errorMessage.set(null);
            };

            instance.onresult = (event: any) => {
                let interim = '';
                let final = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const trans = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        final += trans;
                    } else {
                        interim += trans;
                    }
                }

                const trimmedFinal = final.trim();
                const trimmedInterim = interim.trim();

                if (trimmedFinal) {
                    this.captionResult.next({
                        text: trimmedFinal,
                        isFinal: true,
                        language: this.currentLanguage(),
                    });
                } else if (trimmedInterim) {
                    this.captionResult.next({
                        text: trimmedInterim,
                        isFinal: false,
                        language: this.currentLanguage(),
                    });
                }
            };

            instance.onerror = (event: any) => {
                // Các lỗi thông thường như 'no-speech' không cần báo lỗi nghiêm trọng
                if (event.error === 'no-speech') {
                    return;
                }
                if (event.error === 'not-allowed') {
                    this.errorMessage.set('quyền truy cập micro đã bị từ chối.');
                    this.shouldKeepListening = false;
                    this.isListening.set(false);
                    return;
                }
                // Lỗi không tự hết → dừng hẳn, không khởi động lại liên tục.
                if (event.error === 'network' || event.error === 'service-not-allowed') {
                    this.errorMessage.set('trình duyệt này không kết nối được dịch vụ nhận dạng giọng nói. Hãy dùng Chrome hoặc Edge và kiểm tra Internet.');
                    this.shouldKeepListening = false;
                    this.isListening.set(false);
                    return;
                }
                if (event.error === 'audio-capture') {
                    this.errorMessage.set('không tìm thấy micro.');
                    this.shouldKeepListening = false;
                    this.isListening.set(false);
                    return;
                }
                if (event.error !== 'aborted') {
                    this.errorMessage.set(`lỗi nhận dạng (${event.error}).`);
                }
            };

            instance.onend = () => {
                this.isListening.set(false);
                // Nếu người dùng vẫn muốn bật và không có lỗi từ chối mic, tự động kết nối lại sau 200ms
                if (this.shouldKeepListening) {
                    this.restartTimer = setTimeout(() => {
                        if (this.shouldKeepListening) {
                            this.initRecognition();
                        }
                    }, 250);
                }
            };

            instance.start();
            this.recognition = instance;
        } catch (err: any) {
            this.errorMessage.set(err?.message || 'Không thể khởi động dịch vụ nhận diện giọng nói.');
            this.isListening.set(false);
        }
    }

    private stopRecognitionInstance(): void {
        if (this.recognition) {
            try {
                this.recognition.onstart = null;
                this.recognition.onresult = null;
                this.recognition.onerror = null;
                this.recognition.onend = null;
                this.recognition.stop();
            } catch {
                try {
                    this.recognition.abort();
                } catch {}
            }
            this.recognition = null;
        }
    }

    private clearRestartTimer(): void {
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
    }
}
