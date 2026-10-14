import { Component, inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, finalize, switchMap, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../shared/ng-zorro.module';
import { AuthService } from '../../../shared/services';
import { SessionService, TokenService } from '../../../core';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [SharedModules],
    templateUrl: './login.html',
    styleUrl: './login.scss'
})
export class Login implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject<void>();

    returnUrl = '';
    isLoggingIn = false;
    isPasswordVisible = false;

    isForgotModalVisible = false;
    forgotEmail = '';
    isForgotLoading = false;

    // ===================== Landing UI state =====================
    private readonly typewriterPhrases: string[] = [
        'Họp trực tuyến thông minh',
        'Trước họp · Trong họp · Sau họp',
        'Biên bản AI có dẫn nguồn',
        'Từ cuộc họp đến công việc',
        'Tự chủ hạ tầng và dữ liệu'
    ];
    typedText = '';
    private typePhraseIndex = 0;
    private typeCharIndex = 0;
    private typeDeleting = false;
    private typeTimer: any = null;

    stats: Array<{ icon: string; label: string; target: number; current: number; suffix: string }> = [
        { icon: 'video-camera', label: 'Giai đoạn cuộc họp', target: 3, current: 0, suffix: '' },
        { icon: 'robot', label: 'Biên bản do AI soạn', target: 100, current: 0, suffix: '%' },
        { icon: 'team', label: 'Vai trò trong cuộc họp', target: 5, current: 0, suffix: '' },
        { icon: 'safety', label: 'Dữ liệu tự chủ', target: 100, current: 0, suffix: '%' }
    ];
    private statTimer: any = null;

    readonly features = [
        {
            title: 'Tổ chức cuộc họp',
            subtitle: 'Lên lịch, mời thành phần, chia sẻ link và mã QR.',
            img: 'img/desktop/meeting.png',
            items: [
                'Tạo cuộc họp theo lịch hoặc họp nhanh chỉ với một thao tác',
                'Phân vai chủ trì, đồng chủ trì, thư ký, thành viên',
                'Phòng chờ, cài đặt quyền chat, chia sẻ màn hình, ghi hình'
            ],
            tags: ['Lịch họp', 'Lời mời', 'Phòng chờ', 'QR']
        },
        {
            title: 'Phòng họp trực tuyến',
            subtitle: 'Âm thanh, video, chia sẻ màn hình trên Jitsi tự triển khai.',
            img: 'img/desktop/chat.png',
            items: [
                'Chat chung và riêng theo thời gian thực',
                'Tài liệu, bảng trắng cộng tác ngay trong phòng',
                'Phụ đề trực tiếp, ghi âm và ghi hình'
            ],
            tags: ['Jitsi', 'Chat', 'Bảng trắng', 'Phụ đề']
        },
        {
            title: 'Biên bản AI có dẫn nguồn',
            subtitle: 'Transcript, tóm tắt, quyết định và việc cần làm.',
            img: 'img/desktop/robot.png',
            items: [
                'Mỗi quyết định gắn với mốc thời gian trong transcript',
                'Duyệt và phát hành biên bản, xuất file DOCX theo mẫu',
                'Hỏi đáp AI trên nội dung cuộc họp'
            ],
            tags: ['Transcript', 'AI', 'DOCX', 'Hỏi đáp']
        },
        {
            title: 'Công việc sau họp',
            subtitle: 'Biến kết luận cuộc họp thành việc có người phụ trách.',
            img: 'img/desktop/task.png',
            items: [
                'Công việc ba cấp, bảng Kanban, chia sẻ',
                'Nhắc việc đến hạn, quá hạn',
                'Thông báo realtime khi được giao việc'
            ],
            tags: ['Kanban', 'Nhắc việc', 'Thông báo']
        }
    ];
    activeSlide = 0;
    slideProgress = 0;
    private slideTickTimer: any = null;
    private readonly slideDurationMs = 6000;
    private slideElapsed = 0;

    readonly modules: string[] = [
        'Cuộc họp', 'Lịch họp', 'Phòng chờ', 'Jitsi', 'Chat', 'Tài liệu', 'Bảng trắng',
        'Ghi hình', 'Phụ đề', 'Transcript', 'Biên bản AI', 'Trợ lý AI', 'Công việc', 'Thông báo',
        'Danh bạ', 'Phân quyền', 'Thống kê', 'Nhật ký'
    ];

    particles: Array<{ x: number; y: number; size: number; delay: number; duration: number }> = [];
    parallaxX = 0;
    parallaxY = 0;
    readonly currentYear = new Date().getFullYear();

    welcomeMessage = '';
    private welcomeMessageIndex = 0;
    private messageTimer: any = null;
    private readonly welcomeMessages: string[] = [
        'Mật khẩu mạnh giúp bảo vệ dữ liệu cuộc họp.',
        'Quên mật khẩu? Bạn có thể đặt lại qua email đã đăng ký.',
        'Tài khoản mới sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu.',
        'Biên bản AI luôn cần người duyệt trước khi phát hành.'
    ];

    private readonly fb = inject(NonNullableFormBuilder);
    validateForm = this.fb.group({
        username: this.fb.control('', [Validators.required]),
        password: this.fb.control('', [Validators.required])
    });

    constructor(
        private readonly authService: AuthService,
        private readonly tokenService: TokenService,
        private readonly session: SessionService,
        private readonly router: Router,
        private readonly route: ActivatedRoute,
        private readonly message: NzMessageService,
        private readonly ngZone: NgZone,
    ) { }

    ngOnInit(): void {
        this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
        this.initParticles();
        this.startTypewriter();
        this.startCounters();
        this.startCarousel();
        this.startWelcomeMessageCycle();
    }

    togglePasswordVisibility(): void {
        this.isPasswordVisible = !this.isPasswordVisible;
    }

    loginByAccount(): void {
        if (this.validateForm.invalid) {
            this.markFormAsDirty();
            return;
        }
        if (this.isLoggingIn) return;
        this.isLoggingIn = true;

        const { username, password } = this.validateForm.getRawValue();
        this.authService.login({ userName: username.trim(), password })
            .pipe(
                switchMap(res => {
                    this.session.clear();
                    this.tokenService.setTokens(res.data);
                    return this.session.load({ mustChangePassword: !!res.data?.mustChangePassword });
                }),
                finalize(() => this.isLoggingIn = false),
                takeUntil(this.destroy$),
            )
            .subscribe({
                next: (ok) => {
                    if (!ok) {
                        this.tokenService.clear();
                        this.message.error('Không tải được thông tin tài khoản. Vui lòng thử lại.');
                        return;
                    }
                    this.navigateAfterLogin();
                },
                error: () => {
                    this.validateForm.controls.password.setValue('');
                }
            });
    }

    private navigateAfterLogin(): void {
        if (this.returnUrl && !this.returnUrl.startsWith('/login')) {
            this.router.navigateByUrl(this.returnUrl);
            return;
        }
        this.router.navigate(['/dashboard']);
    }

    private markFormAsDirty(): void {
        Object.values(this.validateForm.controls).forEach(control => {
            if (control.invalid) {
                control.markAsDirty();
                control.updateValueAndValidity({ onlySelf: true });
            }
        });
    }

    openForgotModal(): void {
        this.isForgotModalVisible = true;
        this.forgotEmail = '';
    }

    closeForgotModal(): void {
        this.isForgotModalVisible = false;
    }

    /** BE gửi mã đặt lại qua email; môi trường dev bật EXPOSE_RESET_TOKEN thì mã trả về trực tiếp. */
    requestReset(): void {
        const email = this.forgotEmail.trim();
        if (!email || !email.includes('@')) {
            this.message.warning('Vui lòng nhập email hợp lệ');
            return;
        }
        this.isForgotLoading = true;
        this.authService.forgotPassword(email)
            .pipe(finalize(() => this.isForgotLoading = false), takeUntil(this.destroy$))
            .subscribe(res => {
                this.isForgotModalVisible = false;
                const token = res?.data;
                this.router.navigate(['/reset-password'], token ? { queryParams: { token } } : {});
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        if (this.typeTimer) { clearTimeout(this.typeTimer); this.typeTimer = null; }
        if (this.statTimer) { clearInterval(this.statTimer); this.statTimer = null; }
        if (this.slideTickTimer) { clearInterval(this.slideTickTimer); this.slideTickTimer = null; }
        if (this.messageTimer) { clearInterval(this.messageTimer); this.messageTimer = null; }
    }

    // ===================== Landing animations =====================
    private initParticles(): void {
        this.particles = Array.from({ length: 28 }).map(() => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 2 + Math.random() * 4,
            delay: Math.random() * 8,
            duration: 12 + Math.random() * 16
        }));
    }

    private startTypewriter(): void {
        const typeSpeed = 55;
        const deleteSpeed = 28;
        const holdMs = 1800;

        const tick = () => {
            const phrase = this.typewriterPhrases[this.typePhraseIndex];
            if (!this.typeDeleting) {
                this.typeCharIndex++;
                this.typedText = phrase.substring(0, this.typeCharIndex);
                if (this.typeCharIndex >= phrase.length) {
                    this.typeDeleting = true;
                    this.typeTimer = setTimeout(tick, holdMs);
                    return;
                }
                this.typeTimer = setTimeout(tick, typeSpeed);
            } else {
                this.typeCharIndex--;
                this.typedText = phrase.substring(0, Math.max(0, this.typeCharIndex));
                if (this.typeCharIndex <= 0) {
                    this.typeDeleting = false;
                    this.typePhraseIndex = (this.typePhraseIndex + 1) % this.typewriterPhrases.length;
                    this.typeTimer = setTimeout(tick, 400);
                    return;
                }
                this.typeTimer = setTimeout(tick, deleteSpeed);
            }
        };

        this.ngZone.runOutsideAngular(() => {
            this.typeTimer = setTimeout(() => this.ngZone.run(tick), 600);
        });
    }

    private startCounters(): void {
        const durationMs = 1800;
        const frameMs = 30;
        const steps = Math.max(1, Math.floor(durationMs / frameMs));
        let i = 0;
        this.statTimer = setInterval(() => {
            i++;
            const progress = Math.min(1, i / steps);
            const eased = 1 - Math.pow(1 - progress, 3);
            for (const s of this.stats) {
                s.current = Math.round(s.target * eased);
            }
            if (progress >= 1) {
                clearInterval(this.statTimer);
                this.statTimer = null;
            }
        }, frameMs);
    }

    private startCarousel(): void {
        const tickMs = 60;
        this.ngZone.runOutsideAngular(() => {
            this.slideTickTimer = setInterval(() => {
                this.slideElapsed += tickMs;
                const pct = Math.min(100, (this.slideElapsed / this.slideDurationMs) * 100);
                this.ngZone.run(() => { this.slideProgress = pct; });
                if (this.slideElapsed >= this.slideDurationMs) {
                    this.ngZone.run(() => this.nextSlide());
                }
            }, tickMs);
        });
    }

    goToSlide(i: number): void {
        this.activeSlide = i;
        this.slideElapsed = 0;
        this.slideProgress = 0;
    }

    private nextSlide(): void {
        this.activeSlide = (this.activeSlide + 1) % this.features.length;
        this.slideElapsed = 0;
        this.slideProgress = 0;
    }

    onMouseMove(ev: MouseEvent): void {
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        this.parallaxX = ((ev.clientX / w) - 0.5) * -24;
        this.parallaxY = ((ev.clientY / h) - 0.5) * -24;
    }

    private startWelcomeMessageCycle(): void {
        this.welcomeMessageIndex = 0;
        this.welcomeMessage = this.welcomeMessages[this.welcomeMessageIndex];
        this.messageTimer = setInterval(() => {
            this.welcomeMessageIndex = (this.welcomeMessageIndex + 1) % this.welcomeMessages.length;
            this.welcomeMessage = this.welcomeMessages[this.welcomeMessageIndex];
        }, 3000);
    }
}
