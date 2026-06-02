import { Provider } from 'jotai'
import ThemeProvider from './components/ThemeProvider'
import Shell from './layouts/Shell'

export default function App() {
  return (
    <Provider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </Provider>
  )
}
