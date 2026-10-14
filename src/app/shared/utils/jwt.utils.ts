export class JwtUtils {
  static isJwtFormat(token: string | null | undefined): token is string {
    if (!token) {
      return false;
    }

    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  static parsePayload(token: string | null | undefined): Record<string, any> | null {
    if (!this.isJwtFormat(token)) {
      return null;
    }

    try {
      const payload = token.split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const normalizedPayload = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
      return JSON.parse(atob(normalizedPayload));
    } catch {
      return null;
    }
  }

  static isExpired(token: string | null | undefined): boolean {
    const payload = this.parsePayload(token);
    const exp = payload?.['exp'];

    if (typeof exp !== 'number') {
      return true;
    }

    return Date.now() >= exp * 1000;
  }

  static isUsable(token: string | null | undefined): token is string {
    return this.isJwtFormat(token) && !this.isExpired(token);
  }
}