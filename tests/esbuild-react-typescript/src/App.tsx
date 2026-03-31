import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div id="app">
      <h1>esbuild + React + TypeScript</h1>
      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>
          count is {count}
        </button>
        <p>Edit <code>src/App.tsx</code> and save to test</p>
      </div>
    </div>
  )
}

export default App
