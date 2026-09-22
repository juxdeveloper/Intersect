/**
 * Progressive Web App (PWA) Manager for Intersect.
 *
 * Requirements (Section 10):
 * 1. Automatic background preparation of full offline closure on first visit.
 * 2. No manual consent prompt or 'Prepare offline' prerequisite.
 * 3. Bounded concurrency and cache verification.
 * 4. Install prompt handling for installable PWA.
 * 5. Reusable across visits without duplicate downloads.
 */

export type PwaStatus = 'unsupported' | 'preparing' | 'ready' | 'error';

type Listener = (status: PwaStatus) => void;

class PwaManager {
  private status: PwaStatus = 'preparing';
  private listeners: Set<Listener> = new Set();
  private deferredInstallPrompt: any = null;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        this.registerServiceWorker();
      });

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredInstallPrompt = e;
        this.notify();
      });
    } else {
      this.status = 'unsupported';
    }
  }

  public getStatus(): PwaStatus {
    return this.status;
  }

  public getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  public canInstall(): boolean {
    return this.deferredInstallPrompt !== null;
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredInstallPrompt) return false;
    try {
      this.deferredInstallPrompt.prompt();
      const choice = await this.deferredInstallPrompt.userChoice;
      this.deferredInstallPrompt = null;
      this.notify();
      return choice.outcome === 'accepted';
    } catch {
      return false;
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      // Register sw.js relative to base path
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      this.registration = reg;

      // Proactively check for updated service worker on every page load
      reg.update().catch(() => {});

      // Auto-reload when new service worker takes control so user gets fresh build seamlessly
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });

      // Listen for messages from Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'OFFLINE_READY') {
          this.status = 'ready';
          this.notify();
        } else if (event.data?.type === 'OFFLINE_PREPARING') {
          this.status = 'preparing';
          this.notify();
        } else if (event.data?.type === 'OFFLINE_ERROR') {
          this.status = 'error';
          this.notify();
        }
      });

      // Verify if cache is already fully populated
      const isAlreadyCached = await this.checkCacheCompleteness();
      if (isAlreadyCached) {
        this.status = 'ready';
      } else {
        this.status = 'preparing';
        // Request background precache
        if (reg.active) {
          reg.active.postMessage({ type: 'PREPARE_OFFLINE' });
        }
      }
      this.notify();
    } catch (err) {
      console.warn('PWA ServiceWorker registration failed:', err);
      this.status = 'unsupported';
      this.notify();
    }
  }

  private async checkCacheCompleteness(): Promise<boolean> {
    if (!('caches' in window)) return false;
    try {
      const keys = await caches.keys();
      const intersectCache = keys.find((k) => k.startsWith('intersect-'));
      if (!intersectCache) return false;

      const cache = await caches.open(intersectCache);
      // Read the same-origin build inventory and verify every required asset.
      const response = await fetch('./cache-manifest.json');
      if (!response.ok) return false;
      const manifest = await response.json();
      if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) return false;
      const matches = await Promise.all(
        manifest.assets.map((asset: string) => cache.match(asset)),
      );
      return matches.every(Boolean);
    } catch {
      return false;
    }
  }
}

export const pwaManager = new PwaManager();
