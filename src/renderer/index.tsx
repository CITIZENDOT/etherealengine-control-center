import { render } from 'react-dom'

import App from './App'
import { LogService } from './services/LogService'

LogService.listenLog()

render(<App />, document.getElementById('root'))

export interface IElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  on: (channel: string, func: (...args: any[]) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
