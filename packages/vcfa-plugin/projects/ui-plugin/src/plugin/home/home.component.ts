import { Component, Inject, Optional } from "@angular/core";
import { TranslatePipe } from "@ngx-translate/core";
import { EXTENSION_ASSET_URL } from "@vcfa/sdk";

@Component({
    standalone: true,
    selector: 'home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    imports: [
        TranslatePipe,
    ]
})
export class HomeComponent {
    assetUrl = '/assets';

    constructor(
        @Optional() @Inject(EXTENSION_ASSET_URL) public pluginAssetUrl: string,
    ) {
        this.assetUrl = this.pluginAssetUrl || '/assets';
    }
}
