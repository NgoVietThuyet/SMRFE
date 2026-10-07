import { inject, Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { ChatMessage, MeetingCaptionDto } from '../models/meeting.models';
import { AuthService } from './auth.service';


// Payload TaskChanged — BE TaskController broadcast vào nhóm cuộc họp.
export interface TaskChangedEvent {
    meetingId: string;
    taskId: string;
    action: 'created' | 'updated' | 'deleted' | 'status_updated';
    userName: string;
}

export interface PresenceChangedEvent {
    meetingId: string;
    userName?: string;
    action: 'joined' | 'left' | 'ended' | 'hub_joined' | 'hub_left';
    connectionId?: string;
}

export interface FilesChangedEvent {
    meetingId: string;
    fileId?: string;
    action: 'added' | 'deleted';
}

export interface MeetingStatusChangedEvent {
    meetingId: string;
    status: number;
    action: 'started' | 'ended';
}

// =====================================================
// MeetingHubService — realtime /meetinghub (BE MeetingHub).
// - JoinMeeting/LeaveMeeting theo meetingId (group).
// - ReceiveMessage → chat realtime; ParticipantJoined/Left
//   chỉ mang connectionId nên dùng cho đếm/sync, không map user.
// - TaskChanged → công việc của cuộc họp vừa tạo/sửa/xóa.
// - PresenceChanged → IsJoined sync sau join/leave/end.
// - FilesChanged → tài liệu realtime.
// - MeetingStatusChanged → Ongoing/Ended sync.
// - 1 connection dùng chung, tự reconnect.
// =====================================================
@Injectable({ providedIn: 'root' })
export class MeetingHubService {
    private readonly auth = inject(AuthService);
    private connection: HubConnection | null = null;
    private refCount = 0;
    private currentMeetingId: string | null = null;

    readonly messageReceived = new Subject<ChatMessage>();
    readonly participantChanged = new Subject<void>();
    readonly taskChanged = new Subject<TaskChangedEvent>();
    readonly presenceChanged = new Subject<PresenceChangedEvent>();
    readonly filesChanged = new Subject<FilesChangedEvent>();
    readonly meetingStatusChanged = new Subject<MeetingStatusChangedEvent>();
    readonly captionReceived = new Subject<MeetingCaptionDto>();
    readonly connectionState = new BehaviorSubject<'connected' | 'reconnecting' | 'disconnected'>('disconnected');


    async joinRoom(meetingId: string): Promise<void> {
        if (this.currentMeetingId === meetingId && this.refCount > 0) return;
        await this.ensureConnection();
        const connection = this.connection;
        if (!connection) throw new Error('Không thể kết nối realtime.');
        try {
            await connection.invoke('JoinMeeting', meetingId);
            this.refCount++;
            this.currentMeetingId = meetingId;
        } catch (error) {
            if (this.refCount === 0) await this.stop();
            throw error;
        }
    }

    async leaveRoom(meetingId: string): Promise<void> {
        if (!this.connection) return;
        try {
            await this.connection.invoke('LeaveMeeting', meetingId);
        } finally {
            this.refCount = Math.max(0, this.refCount - 1);
            if (this.refCount === 0) {
                this.currentMeetingId = null;
                await this.stop();
            } else if (this.currentMeetingId === meetingId) {
                this.currentMeetingId = null;
            }
        }
    }

    async broadcastMessage(meetingId: string, message: ChatMessage): Promise<void> {
        if (!this.connection) return;
        await this.connection.invoke('SendMessage', meetingId, message);
    }

    async broadcastCaption(meetingId: string, caption: MeetingCaptionDto): Promise<void> {
        if (!this.connection) return;
        await this.connection.invoke('SendCaption', meetingId, caption);
    }

    get hubConnection(): HubConnection | null {
        return this.connection;
    }

    private async ensureConnection(): Promise<void> {
        if (this.connection) {
            if (this.connection.state === 'Disconnected') await this.startExistingConnection(this.connection);
            return;
        }
        const connection = new HubConnectionBuilder()
            .withUrl(`${API_BASE_URL}/meetinghub`, {
                accessTokenFactory: () => this.auth.getAccessToken() ?? '',
            })
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Warning)
            .build();
        connection.onreconnecting(() => this.connectionState.next('reconnecting'));
        connection.onreconnected(() => this.connectionState.next('connected'));
        connection.onclose(() => this.connectionState.next('disconnected'));
        connection.on('ReceiveMessage', (envelope: unknown) => {
            this.messageReceived.next(envelope as ChatMessage);
        });
        connection.on('ReceiveCaption', (envelope: unknown) => {
            this.captionReceived.next(envelope as MeetingCaptionDto);
        });
        connection.on('ParticipantJoined', () => this.participantChanged.next());
        connection.on('ParticipantLeft', () => this.participantChanged.next());
        connection.on('TaskChanged', (e: TaskChangedEvent) => this.taskChanged.next(e));
        connection.on('PresenceChanged', (e: PresenceChangedEvent) => {
            this.presenceChanged.next(e);
            this.participantChanged.next();
        });
        connection.on('FilesChanged', (e: FilesChangedEvent) => this.filesChanged.next(e));
        connection.on('MeetingStatusChanged', (e: MeetingStatusChangedEvent) => this.meetingStatusChanged.next(e));
        connection.onreconnected(async () => {
            this.participantChanged.next();
            if (this.currentMeetingId) {
                try {
                    await connection.invoke('JoinMeeting', this.currentMeetingId);
                } catch {
                    // ignore rejoin failure — will retry on next ensureConnection
                }
            }
        });
        this.connection = connection;
        await this.startExistingConnection(connection);
    }

    private async startExistingConnection(connection: HubConnection): Promise<void> {
        this.connectionState.next('reconnecting');
        try {
            await connection.start();
            this.connectionState.next('connected');
        } catch (error) {
            this.connectionState.next('disconnected');
            throw error;
        }
    }

    private async stop(): Promise<void> {
        try {
            await this.connection?.stop();
        } finally {
            this.connection = null;
            this.connectionState.next('disconnected');
        }
    }
}
