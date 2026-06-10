import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { AuthService } from './app/service/auth.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withHashLocation())
  ]
}).then(appRef => {
  // Silently restore session from stored refresh token before rendering
  const auth = appRef.injector.get(AuthService);
  return auth.init();
}).catch(err => console.error(err));
