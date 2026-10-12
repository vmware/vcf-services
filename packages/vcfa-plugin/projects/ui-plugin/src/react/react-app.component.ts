import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, Inject, Optional, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ClarityModule } from '@clr/angular';
import { EXTENSION_ASSET_URL, EXTENSION_ROUTE } from '@vcfa/sdk';

import { createFederationInstance } from './federation';

@Component({
  selector: 'react-app',
  imports: [
    RouterOutlet,
    ClarityModule,
    NgComponentOutlet,
    CommonModule,
  ],
  templateUrl: './react-app.component.html',
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
})
export class ReactAppComponent {
  @ViewChild('reactApp', {static: true}) reactApp: ElementRef | undefined;

  private assetsUrl: string = '/assets';
  private baseHref: string = '/react-example';

  constructor(
    @Optional() @Inject(EXTENSION_ASSET_URL) private EXTENSION_ASSET_URL: string,
    @Optional() @Inject(EXTENSION_ROUTE) private EXTENSION_ROUTE: string,
  ) {
    if (this.EXTENSION_ASSET_URL) {
      this.assetsUrl = this.EXTENSION_ASSET_URL;
    }

    if (this.EXTENSION_ROUTE) {
      this.baseHref = `${this.EXTENSION_ROUTE}/react-example`;
    }

    this.loadReactApplication();
  }

  private loadReactApplication() {
    const mf = createFederationInstance();
    mf.registerRemotes([
      {
        name: "react",
        entry: `${this.assetsUrl}/react-plugin/dist/remoteEntry.js`,
        type: "script",
        entryGlobalName: "react_example_ui"
      }
    ]);

    mf.loadRemote("react/web-components").then((m) => {
      const elementName = 'react-element';
      const reactApp = document.createElement(elementName);
      reactApp.setAttribute("baseHref", this.baseHref);
      this.reactApp?.nativeElement.appendChild(reactApp);
    }).catch((e) => {
      console.error("React Application failed to load", e);
      this.reactApp?.nativeElement.appendChild(document.createTextNode("React Application failed to load..."));
    });
  }
}
