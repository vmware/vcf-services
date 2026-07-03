import { HttpClient } from '@angular/common/http';
import { TranslateLoader } from '@ngx-translate/core';

export class DynamicTranslateLoader implements TranslateLoader {
    constructor(
        private http: HttpClient,
        private prefix: string = './assets/i18n/',
        private suffix: string = '.json'
    ) { }

    /**
     * Gets the translations for a given language.
     * @param lang The language to get the translations for.
     * @returns An observable containing the loaded translations.
     */
    public getTranslation(lang: string): any {
        const fullPath = `${this.prefix}${lang}${this.suffix}`;
        return this.http.get(fullPath);
    }
}