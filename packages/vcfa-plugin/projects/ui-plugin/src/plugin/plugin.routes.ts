import { Routes } from "@angular/router";
import { HomeComponent } from "./home/home.component";
import { JwtIframeComponent } from "./jwt-iframe/jwt-iframe.component";
import { ReactAppComponent } from "../react/react-app.component";

export const routes: Routes = [
    { path: "", redirectTo: "home", pathMatch: "full" },
    { path: "home", component: HomeComponent },
    { path: "react-example", component: ReactAppComponent },
    { path: "access-token", component: JwtIframeComponent },
];
