import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment.dev';

@Injectable({
  providedIn: 'root',
})
export class EnvironmentService {
  getEnv(key: string): any {
    return (environment as Record<string, any>)[key] ?? null;
  }

  getAll(): any {
    return environment;
  }
}
