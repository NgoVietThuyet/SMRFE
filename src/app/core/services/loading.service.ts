import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
    private count = 0;
    private loading = new BehaviorSubject<boolean>(false);

    show(): void {
        this.count++;
        if (this.count === 1) {
            const loader = document.getElementById('global-loading');
            if (loader) loader.style.display = 'block';
        }
    }

    hide(): void {
        this.count = Math.max(this.count - 1, 0);
        if (this.count === 0) {
            const loader = document.getElementById('global-loading');
            if (loader) loader.style.display = 'none';
        }
    }

    reset(): void {
        this.count = 0;
        const loader = document.getElementById('global-loading');
        if (loader) loader.style.display = 'none';
    }

    setLoading(isLoading: boolean): void {
        setTimeout(() => {
            if (isLoading) {
                this.show();
            } else {
                this.hide();
            }
        });
    }
    getLoading(): Observable<boolean> {
        return this.loading.asObservable();
    }
}
