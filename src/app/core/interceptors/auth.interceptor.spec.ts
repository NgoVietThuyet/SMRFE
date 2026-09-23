import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;
    let token: string | null;
    let unauthorizedCalls: number;

    beforeEach(() => {
        token = 'access-1';
        unauthorizedCalls = 0;

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                {
                    provide: AuthService,
                    useValue: {
                        getAccessToken: () => token,
                        refresh: () => of('access-2'),
                        handleUnauthorized: () => {
                            unauthorizedCalls++;
                        },
                    },
                },
            ],
        });

        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it('should attach Bearer token to API requests', () => {
        http.get('http://localhost:5228/api/Meeting').subscribe();
        const req = httpMock.expectOne('http://localhost:5228/api/Meeting');
        expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
        req.flush({});
    });

    it('should skip Bearer for login endpoint', () => {
        http.post('http://localhost:5228/api/Auth/Login', {}).subscribe();
        const req = httpMock.expectOne('http://localhost:5228/api/Auth/Login');
        expect(req.request.headers.has('Authorization')).toBe(false);
        req.flush({});
    });

    it('should refresh once and retry after 401', () => {
        http.get('http://localhost:5228/api/Meeting').subscribe({
            next: (res) => expect(res).toEqual({ ok: true }),
        });

        const first = httpMock.expectOne('http://localhost:5228/api/Meeting');
        expect(first.request.headers.get('Authorization')).toBe('Bearer access-1');
        first.flush({}, { status: 401, statusText: 'Unauthorized' });

        const retry = httpMock.expectOne('http://localhost:5228/api/Meeting');
        expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
        retry.flush({ ok: true });

        expect(unauthorizedCalls).toBe(0);
    });

    it('should logout and surface error when refresh fails', () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                {
                    provide: AuthService,
                    useValue: {
                        getAccessToken: () => 'expired',
                        refresh: () => throwError(() => new Error('expired')),
                        handleUnauthorized: () => {
                            unauthorizedCalls++;
                        },
                    },
                },
            ],
        });
        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);

        let failed = false;
        http.get('http://localhost:5228/api/Meeting').subscribe({ error: () => (failed = true) });

        httpMock.expectOne('http://localhost:5228/api/Meeting').flush(
            {},
            { status: 401, statusText: 'Unauthorized' }
        );

        expect(failed).toBe(true);
        expect(unauthorizedCalls).toBe(1);
    });
});
