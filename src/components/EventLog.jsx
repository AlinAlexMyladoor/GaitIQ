import React, { useState } from 'react';
import { Check, CheckCheck, Trash2, ShieldAlert, Download, BellOff } from 'lucide-react';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'Active', label: 'Active' },
  { id: 'Resolved', label: 'Resolved' },
];

export default function EventLog({ events = [], onAcknowledge, onAcknowledgeAll, onClear, onExport }) {
  const [filter, setFilter] = useState('all');

  const filtered = events.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'Resolved') return e.status === 'Resolved' || e.status === 'Acknowledged';
    return e.status === 'Active';
  });
  const shown = filtered.slice(0, 10);
  const activeCount = events.filter((e) => e.status === 'Active').length;

  return (
    <section className="card card-pad animate-in delay-4" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-head">
        <div>
          <h2 className="card-title">
            <ShieldAlert size={17} color="var(--warn)" />Threshold event log
            <span className="pill pill-muted">{events.length}</span>
          </h2>
          <p className="card-sub">{activeCount > 0 ? `${activeCount} active now` : 'No active events'}</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="seg" role="group" aria-label="Filter events">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
            ))}
          </div>
          {activeCount > 0 && (
            <button type="button" className="btn btn-sm" onClick={onAcknowledgeAll} title="Acknowledge all active events"><CheckCheck size={14} />Ack all</button>
          )}
          {events.length > 0 && (
            <>
              <button type="button" className="btn btn-icon btn-sm" onClick={onExport} title="Export events as CSV" aria-label="Export events"><Download size={14} /></button>
              <button id="btn-clear-events" type="button" className="btn btn-icon btn-sm btn-danger" onClick={onClear} title="Clear event log" aria-label="Clear events"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><BellOff size={20} /></div>
          <span>{events.length === 0 ? 'No threshold events in this session.' : 'No events match this filter.'}</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Time</th><th>Plantar site</th><th>Peak</th><th>Duration</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th></tr>
            </thead>
            <tbody>
              {shown.map((evt) => {
                const active = evt.status === 'Active';
                return (
                  <tr key={evt.id}>
                    <td className="mono" style={{ color: 'var(--t2)' }}>{evt.timestamp}</td>
                    <td style={{ fontWeight: 600 }}>{evt.location}</td>
                    <td className="num" style={{ fontWeight: 700, color: evt.peakLoad >= 90 ? 'var(--danger)' : 'var(--warn)' }}>{evt.peakLoad}%</td>
                    <td className="num" style={{ color: 'var(--t2)' }}>{active ? 'Ongoing…' : `${(evt.durationMs / 1000).toFixed(1)}s`}</td>
                    <td>
                      {active ? <span className="pill pill-danger"><span className="dot dot-danger dot-live" />Active</span>
                        : evt.status === 'Acknowledged' ? <span className="pill pill-warn">Acknowledged</span>
                        : <span className="pill pill-muted">Resolved</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {active && <button type="button" className="btn btn-sm" onClick={() => onAcknowledge && onAcknowledge(evt.id)}><Check size={13} />Ack</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > shown.length && (
        <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>Showing latest {shown.length} of {filtered.length} events — export CSV for the full list.</p>
      )}
    </section>
  );
}
