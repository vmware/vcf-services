import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ClarityModule } from "@clr/angular";
import { StandaloneHelperModule } from "./standalone/standalone.helper.module";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { ClarityIcons, homeIcon } from "@clr/angular";
ClarityIcons.addIcons(homeIcon);

@Component({
    imports: [
        ClarityModule,
        CommonModule,
        StandaloneHelperModule,
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
    ],
    selector: "plugin-subnav",
    templateUrl: "./subnav.component.html",
    host: { "class": "content-container" },
    styleUrls: ["subnav.component.scss"],
})
export class SubnavComponent {
    navItems: any[] = [
        { routerLink: "./home", iconShape: "home", labelKey: "Home" }
    ];
}
