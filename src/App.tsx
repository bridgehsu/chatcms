import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { SettingsModal } from "./components/SettingsModal";
import { PermissionModal } from "./components/PermissionModal";
import "./App.css";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-area">
        <header className="topbar">
          <span />
          <button className="btn-settings" onClick={() => setSettingsOpen(true)}>
            ⚙
          </button>
        </header>

        <ChatWindow />
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PermissionModal />
    </div>
  );
}

export default App;
