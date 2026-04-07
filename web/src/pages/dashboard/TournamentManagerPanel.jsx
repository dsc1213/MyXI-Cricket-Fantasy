import { useState } from 'react'
import AdminManagerPanel from './AdminManagerPanel.jsx'
import CreateTournamentPanel from './CreateTournamentPanel.jsx'
import Button from '../../components/ui/Button.jsx'

function TournamentManagerPanel() {
  const [activeTab, setActiveTab] = useState('manage')
  const [preferredTournamentId, setPreferredTournamentId] = useState('')

  return (
    <section className="dashboard-section tournament-manager-shell">
      <div
        className="tournament-manager-tabs"
        role="tablist"
        aria-label="Tournament manager modes"
      >
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={activeTab === 'manage'}
          className={`tournament-manager-tab-btn ${activeTab === 'manage' ? 'active' : ''}`.trim()}
          onClick={() => setActiveTab('manage')}
        >
          Manage
        </Button>
        <Button
          type="button"
          variant="ghost"
          role="tab"
          aria-selected={activeTab === 'create'}
          className={`tournament-manager-tab-btn ${activeTab === 'create' ? 'active' : ''}`.trim()}
          onClick={() => setActiveTab('create')}
        >
          Create
        </Button>
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
