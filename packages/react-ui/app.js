import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, MemoryRouter, Switch, Route } from 'react-router-dom';

import Home from './Home';

function App({ baseHref }) {
    // When the host app uses hash-based routing (e.g. VCFA tenant), Angular owns
    // the hash so React cannot use BrowserRouter (pathname mismatch) or HashRouter
    // (it would read Angular's hash segment). MemoryRouter is used instead.
    const isHashBased = baseHref && !window.location.pathname.startsWith(baseHref);
    const Router = isHashBased ? MemoryRouter : BrowserRouter;
    const routerProps = isHashBased ? { initialEntries: ['/'] } : { basename: baseHref };

    return (
        <Router {...routerProps}>
            <div className="App">
                <div className="content">
                    <Switch>
                        <Route path="/" exact component={Home} />
                    </Switch>
                </div>
            </div>
        </Router>
    );
}

class MyReactAppUIElement extends HTMLElement {
    connectedCallback() {
        const baseHref = this.getAttribute('baseHref');
        ReactDOM.render(<App baseHref={baseHref} />, this);
    }

    static get observedAttributes() {
        return ['baseHref'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'baseHref') {
            console.log(`baseHref changed from ${oldValue} to ${newValue}`);
        }
    }

}

customElements.define('react-element', MyReactAppUIElement);
