import { computed, inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';

export const LANGUAGES = ['pl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'language';

@Injectable({
    providedIn: 'root',
})
export class LanguageService {
    private readonly translate = inject(TranslateService);
    private readonly storage = inject(StorageService);

    /** Current UI language; also usable as the locale argument of number/date pipes. */
    readonly current = computed<Language>(() => (this.translate.currentLang() === 'pl' ? 'pl' : 'en'));

    /** Saved preference, then device language, then English. */
    async init(): Promise<void> {
        const saved = await this.storage.get<Language>(STORAGE_KEY).catch(() => null);
        const device: Language = navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
        await this.apply(saved && LANGUAGES.includes(saved) ? saved : device);
    }

    async set(language: Language): Promise<void> {
        await this.apply(language);
        await this.storage.set(STORAGE_KEY, language);
    }

    private async apply(language: Language): Promise<void> {
        document.documentElement.lang = language;
        await firstValueFrom(this.translate.use(language));
    }
}
