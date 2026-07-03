import { Routes } from "@angular/router";
import { HomeComponent } from "../plugin/home/home.component";
import { JwtIframeComponent } from "../plugin/jwt-iframe/jwt-iframe.component";
import { ReactAppComponent } from "../react/react-app.component";

export const routes: Routes = [
    { path: "", redirectTo: "home", pathMatch: "full" },
    { path: "home", component: HomeComponent },
    { path: "access-token", component: JwtIframeComponent },
    { path: "react-example", component: ReactAppComponent },
];
