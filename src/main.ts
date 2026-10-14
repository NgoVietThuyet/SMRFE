// Must be imported first — registers the Trusted Types 'default' policy before
// any third-party code runs. See src/app/core/security/trusted-types.ts.
import './app/core/security/trusted-types';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
