import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, OnDestroy, OnInit, AfterViewInit, Optional, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthTokenHolderService, EXTENSION_ASSET_URL } from '@vcfa/sdk';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-jwt-iframe',
  templateUrl: './jwt-iframe.component.html',
  styleUrls: ['./jwt-iframe.component.scss'],
})
export class JwtIframeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('iframe', { static: true }) iframe!: ElementRef;
  private destroy$ = new Subject<void>();
  // A placeholder URL for the iframe content.
  // In a real scenario, this would be the URL of the page that can receive the JWT.
  iframeSrc: SafeResourceUrl = '/iframe-content.html';

  constructor(
        @Optional() @Inject(EXTENSION_ASSET_URL) public pluginAssetUrl: string,
        @Optional() @Inject(AuthTokenHolderService) private authTokenHolderService: AuthTokenHolderService,
        private sanitizer: DomSanitizer,
    ) {}

  ngOnInit(): void {
    this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(`${this.pluginAssetUrl ? this.pluginAssetUrl : '/assets'}/iframe-content.html`); 
  }

  ngAfterViewInit(): void {
    this.initTokenListener();
    window.addEventListener('message', this.handleIframeMessage.bind(this));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('message', this.handleIframeMessage.bind(this));
  }

  private handleIframeMessage(event: MessageEvent): void {
    if (event.data && event.data.status === 'ready') {
      this.initTokenListener();
    }
  }

  private initTokenListener(): void {
    if (this.authTokenHolderService) {
        // Send the initial token
        this.sendToken(this.authTokenHolderService.jwt);

        // Subscribe to token changes
        if (this.authTokenHolderService.jwtAsync) {
            this.authTokenHolderService.jwtAsync
                .pipe(takeUntil(this.destroy$))
                .subscribe((token: string | undefined) => {
                    this.sendToken(token);
                });
        }
    } else {
        this.sendToken(undefined);
    }
  }

  private sendToken(token: string | undefined): void {
    if (this.iframe && this.iframe.nativeElement.contentWindow) {
        this.iframe.nativeElement.contentWindow.postMessage(token, '*');
    }
  }
}
