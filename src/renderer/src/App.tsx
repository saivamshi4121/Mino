import Island from './island/Island'
import Settings from './Settings'

function App(): React.JSX.Element {
  if (new URLSearchParams(window.location.search).get('window') === 'settings') {
    return <Settings />
  }
  return <Island />
}

export default App
