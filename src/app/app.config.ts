import { ApplicationConfig } from '@angular/core'
import { provideRouter } from '@angular/router'
import { provideStore } from '@ngrx/store'
import { providePrimeNG } from 'primeng/config'
import Aura from '@primeng/themes/aura'
import { provideApollo } from 'apollo-angular'
import { ApolloLink, InMemoryCache, Observable } from '@apollo/client/core'
import { routes } from './app.routes'
import { weldReducer } from './store/weld.reducer'
import { buildSeed } from './seed'

const mockData = buildSeed()

const mockGraphqlLink = new ApolloLink((operation) => new Observable((observer) => {
  const timer = setTimeout(() => {
    observer.next({ data: operation.operationName === 'Welds' ? mockData : {} })
    observer.complete()
  }, 180)
  return () => clearTimeout(timer)
}))

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideStore({ welds: weldReducer }),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: false } } }),
    provideApollo(() => ({ cache: new InMemoryCache(), link: mockGraphqlLink })),
  ],
}
