import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { DynamicTranslateLoader } from './plugin/dynamic-translate-loader';
import { EXTENSION_ASSET_URL } from '@vcfa/sdk';

export { SubnavComponent } from './plugin/subnav.component';
export { routes } from './plugin/plugin.routes';
export const providers = [
    provideHttpClient(),
    provideTranslateService({
        loader: {
            provide: TranslateLoader,
            useFactory: (http: HttpClient, assetUrl: string) => new DynamicTranslateLoader(http, `${assetUrl}/i18n/`),
            deps: [HttpClient, EXTENSION_ASSET_URL],
        },
        fallbackLang: 'en',
    }),
];