import { Injectable } from '@angular/core';

// Kiểu tối thiểu của JitsiMeetExternalAPI. Host và script URL do BE cấp qua join-info.
export interface JitsiApi {
    executeCommand(command: string, ...args: unknown[]): void;
    addEventListener(event: string, handler: (payload?: Record<string, unknown>) => void): void;
    removeEventListener(event: string): void;
    getNumberOfParticipants(): number;
    isAudioMuted(): Promise<boolean>;
    isVideoMuted(): Promise<boolean>;
    dispose(): void;
}

export interface JitsiRoomOptions {
    domain: string;
    externalApiUrl?: string;
    roomName: string;
    displayName: string;
    subject: string;
    startWithAudioMuted: boolean;
    startWithVideoMuted: boolean;
    parentNode: HTMLElement;
    /** Thiết bị chọn ở phòng chờ (Jitsi khớp theo label). */
    devices?: { audioInput?: string; audioOutput?: string; videoInput?: string };
}

declare global {
    interface Window {
        JitsiMeetExternalAPI?: new (
            domain: string,
            options: Record<string, unknown>
        ) => JitsiApi;
    }
}

// =====================================================
// JitsiService — nạp external_api.js 1 lần + khởi tạo
// phòng với toolbar gốc ẨN (chrome custom của SMR điều
// khiển qua executeCommand / events).
// =====================================================
@Injectable({ providedIn: 'root' })
export class JitsiService {
    private loadPromise: Promise<void> | null = null;

    load(domain?: string, externalApiUrl?: string): Promise<void> {
        if (typeof window !== 'undefined' && window.JitsiMeetExternalAPI) {
            return Promise.resolve();
        }
        const effectiveDomain = domain && domain !== 'undefined' ? domain : 'meet.d2s.vn';
        if (!this.loadPromise) {
            this.loadPromise = new Promise<void>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = externalApiUrl || `https://${effectiveDomain}/external_api.js`;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => {
                    this.loadPromise = null;
                    reject(new Error('Không tải được Jitsi Meet API.'));
                };
                document.head.appendChild(script);
            });
        }
        return this.loadPromise;
    }

    async createRoom(options: JitsiRoomOptions): Promise<JitsiApi> {
        const effectiveDomain = options.domain && options.domain !== 'undefined' ? options.domain : 'meet.d2s.vn';
        await this.load(effectiveDomain, options.externalApiUrl);
        const Ctor = window.JitsiMeetExternalAPI;
        if (!Ctor) throw new Error('Không tải được Jitsi Meet API.');
        return new Ctor(effectiveDomain, {
            roomName: options.roomName,
            parentNode: options.parentNode,
            ...(options.devices ? { devices: options.devices } : {}),
            userInfo: { displayName: options.displayName },
            configOverwrite: {
                prejoinPageEnabled: false,
                startWithAudioMuted: options.startWithAudioMuted,
                startWithVideoMuted: options.startWithVideoMuted,
                disableDeepLinking: true,
            },
            // Ẩn toàn bộ toolbar gốc — SMR vẽ control bar riêng
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: [],
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                SHOW_BRAND_OVERLAY: false,
                SHOW_POWERED_BY: false,
                HIDE_DEEP_LINKING_LOGO: true,
                MOBILE_APP_PROMO: false,
            },
        });
    }
}
