import { registerRootComponent } from 'expo';

import App from './App';

// `registerRootComponent` radi i za Expo Go i za `prebuild` gradnju.
// TV zahtijeva prebuild (v. README) — Expo Go ne podržava Android TV.
registerRootComponent(App);
