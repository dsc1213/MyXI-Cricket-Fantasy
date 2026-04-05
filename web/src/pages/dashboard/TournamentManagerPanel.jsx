import { useState } from 'react'
import AdminManagerPanel from './AdminManagerPanel.jsx'
import CreateTournamentPanel from './CreateTournamentPanel.jsx'

function TournamentManagerPanel() {
  const [activeTab, setActiveTab] = useState('manage')
  const [preferredTournamentId, setPreferredTournamentId] = useState('')

  return (
    <section className="dashboard-section tournament-manager-shell">
      <div className="upload-tab-row tournament-manager-tabs" role="tablist" aria-label="Tournament manager modes">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'manage'}
          className={`upload-tab-btn ${activeTab === 'manage' ? 'active' : ''}`.trim()}
          onClick={() => setActiveTab('manage')}
        >
          Manage
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'create'}
          className={`upload-tab-btn ${activeTab === 'create' ? 'active' : ''}`.trim()}
          onClick={() => setActiveTab('create')}
        >
          Create
        </button>
      </div>

      {activeTab === 'manage' ? (
        <AdminManagerPanel
          initialTab="tournaments"
          hideTabs
          tournamentSelectorOnly
          preferredTournamentId={preferredTournamentId}
        />
      ) : (
        <CreateTournamentPanel
          onCreated={({ tournamentId, openAdmin }) => {
            if (!tournamentId) return
            setPreferredTournamentId(String(tournamentId))
            if (openAdmin !== false) setActiveTab('manage')
          }}
        />
      )}
    </section>
  )
}

export default TournamentManagerPanel
