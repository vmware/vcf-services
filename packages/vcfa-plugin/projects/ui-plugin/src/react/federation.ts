import { init, ModuleFederation } from '@module-federation/enhanced/runtime';

export function createFederationInstance(): ModuleFederation {
    // Store React dependencies in separate module federation instance.
    const mf: ModuleFederation = init({
        name: 'my-react-plugin-host',
        remotes: [],
        shared: {}
    });
    mf.initializeSharing();
    return mf;
}
