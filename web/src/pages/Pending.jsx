function Pending() {
  return (
    <section className="pending">
      <div className="pending-card">
        <h2>Approval pending</h2>
        <p>
          Your request is with the master admin. You will be able to join
          tournaments once approved.
        </p>
        <div className="pending-meta">
          <div>
            <span>Status</span>
            <strong>Awaiting review</strong>
          </div>
          <div>
            <span>Next check</span>
            <strong>Every 10 minutes</strong>
          </div>
        </div>
        <button type="button" className="ghost wide">
          Refresh status
        </button>
      </div>
    </section>
  )
}

export default Pending
