import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { EnvironmentService, TokenService } from '../../core';
import { NotificationCreatedEvent, NotificationsReadEvent } from '../models';

/** Sự kiện của phòng họp (P10) đẩy từ BE — xem SignalRMeetingEventPublisher / MeetingRoomServiceImpl. */
export const ROOM_EVENTS = [
    'PresenceChanged', 'ParticipantsChanged', 'ReceiveMessage', 'ReceiveCaption', 'MeetingStatusChanged',
    'LobbyChanged', 'LobbyDecision', 'ForceMute', 'Kicked', 'RoleChanged', 'FilesChanged', 'TaskChanged',
    'WhiteboardOp', 'WhiteboardSaved', 'WhiteboardLockChanged', 'RecordingChanged',
    // P13 — tiến độ sinh / duyệt biên bản (gửi tới thành viên cuộc họp)
    'MinutesStatusChanged',
] as const;
export type RoomEventName = typeof ROOM_EVENTS[number];
export interface RoomEvent { name: RoomEventName; payload: any }

/**
 * Kết nối SignalR tới /meetinghub của BE-Java (xác thực bằng query access_token).
 * Kênh cá nhân (thông báo, phòng chờ) + kênh phòng họp (JoinMeeting/LeaveMeeting, P10).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeHubService {
    private connection: HubConnection | null = null;
    private starting: Promise<void> | null = null;

    readonly connectionState = new BehaviorSubject<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
    readonly notificationCreated = new Subject<NotificationCreatedEvent>();
    readonly notificationsRead = new Subject<NotificationsReadEvent>();
    readonly roomEvent = new Subject<RoomEvent>();

    /** Phòng đang tham gia — để tự JoinMeeting lại sau khi kết nối lại. */
    private room: { meetingId: string; clientSessionId: string } | null = null;

    constructor(
        private env: EnvironmentService,
        private tokenService: TokenService,
    ) { }

    async start(): Promise<void> {
        if (this.connection?.state === HubConnectionState.Connected) return;
        if (this.starting) return this.starting;

        if (!this.connection) {
            this.connection = this.build();
        }
        this.starting = this.connection.start()
            .then(() => this.connectionState.next('connected'))
            .catch(() => this.connectionState.next('disconnected'))
            .finally(() => { this.starting = null; });
        return this.starting;
    }

    /** Vào nhóm realtime của phòng. BE từ chối nếu chưa qua phòng chờ. */
    async joinMeeting(meetingId: string, clientSessionId: string): Promise<void> {
        await this.start();
        if (this.connection?.state !== HubConnectionState.Connected) {
            throw new Error('Không kết nối được máy chủ realtime.');
        }
        await this.connection.invoke('JoinMeeting', meetingId, clientSessionId);
        this.room = { meetingId, clientSessionId };
    }

    async leaveMeeting(meetingId: string): Promise<void> {
        if (this.room?.meetingId === meetingId) this.room = null;
        if (this.connection?.state === HubConnectionState.Connected) {
            try { await this.connection.invoke('LeaveMeeting', meetingId); } catch { /* đã rời */ }
        }
    }

    /** Nét vẽ tạm thời của bảng trắng (BE chuyển cho người khác trong phòng). */
    sendWhiteboardOp(meetingId: string, op: unknown): void {
        if (this.connection?.state === HubConnectionState.Connected) {
            this.connection.invoke('SendWhiteboardOp', meetingId, op).catch(() => { /* bảng bị khóa / mất kết nối */ });
        }
    }

    sendCaption(meetingId: string, caption: unknown): void {
        if (this.connection?.state === HubConnectionState.Connected) {
            this.connection.invoke('SendCaption', meetingId, caption).catch(() => { /* bỏ qua */ });
        }
    }

    async stop(): Promise<void> {
        const connection = this.connection;
        this.connection = null;
        if (connection && connection.state !== HubConnectionState.Disconnected) {
            try { await connection.stop(); } catch { /* đã ngắt */ }
        }
        this.connectionState.next('disconnected');
    }

    private build(): HubConnection {
        const connection = new HubConnectionBuilder()
            .withUrl(`${this.env.getEnv('serverUrl')}/meetinghub`, {
                accessTokenFactory: () => this.tokenService.getAccessToken() ?? '',
            })
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Warning)
            .build();

        connection.onreconnecting(() => this.connectionState.next('reconnecting'));
        connection.onreconnected(() => {
            this.connectionState.next('connected');
            // Kết nối mới → BE coi là kết nối khác; vào lại phòng với cùng ClientSessionId.
            const room = this.room;
            if (room) {
                connection.invoke('JoinMeeting', room.meetingId, room.clientSessionId).catch(() => { /* bị mời ra khi mất mạng */ });
            }
        });
        connection.onclose(() => this.connectionState.next('disconnected'));
        connection.on('NotificationCreated', (e: NotificationCreatedEvent) => this.notificationCreated.next(e));
        connection.on('NotificationsRead', (e: NotificationsReadEvent) => this.notificationsRead.next(e));
        ROOM_EVENTS.forEach(name => connection.on(name, (payload: any) => this.roomEvent.next({ name, payload })));
        return connection;
    }
}
