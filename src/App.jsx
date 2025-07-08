import BeanVisualizer from "./BeanVisualizer";
import './App.css'

function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#181825", padding: 32 }}>
      <h1 style={{ textAlign: "center", color: "#6DB33F", marginBottom: 32, letterSpacing: 1 }}>Simulador de Beans Spring (Demo)</h1>
      <BeanVisualizer />
    </div>
  );
}

export default App
