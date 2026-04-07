import { useState } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>Webpack + React + TypeScript</h1>
      <p>
        Edit <code>src/App.tsx</code> and save to test HMR
      </p>
      <button className="counter" onClick={() => setCount((c) => c + 1)}>
        Count is {count}
      </button>
    </div>
  );
}

export default App;
