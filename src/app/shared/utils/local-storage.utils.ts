import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

const SECRET_KEY_LOCAL_STORAGE = 'iOYUg1}T+P>QiAni<yO,e0;kMkMl3*N_';
export class LocalStorageUtils {
  static setItem(key: string, value: any): void {
    try {
      const jsonData = JSON.stringify(value);
      const encrypted = AES.encrypt(
        jsonData,
        SECRET_KEY_LOCAL_STORAGE
      ).toString();
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error(`SetItem failed for key "${key}"`, error);
    }
  }

  static getItem(key: string): any | null {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;

      const decrypted = AES.decrypt(
        encrypted,
        SECRET_KEY_LOCAL_STORAGE
      ).toString(Utf8);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error(`Lỗi khi lấy dữ liệu key "${key}" từ LocalStorage`, error);
      return null;
    }
  }

  static removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  /** Khoá cấu hình giao diện được giữ lại khi đăng xuất. */
  private static readonly KEEP_KEYS = ['sidebarCollapsed'];

  static clear(): void {
    const kept = LocalStorageUtils.KEEP_KEYS
      .map(key => [key, localStorage.getItem(key)] as const)
      .filter(([, value]) => value !== null);
    localStorage.clear();
    kept.forEach(([key, value]) => localStorage.setItem(key, value as string));
  }

  static exists(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }

  static debugDecrypt(key: string): string | null {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;

      return AES.decrypt(encrypted, SECRET_KEY_LOCAL_STORAGE).toString(Utf8);
    } catch (error) {
      console.warn(`DebugDecrypt failed for key "${key}"`, error);
      return null;
    }
  }
}
