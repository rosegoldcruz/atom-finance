import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { PageHeader, StateMessage } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import type { SettingsPayload } from '../types';

export function SettingsPage() {
  const { data, error, loading, reload } = useApi<SettingsPayload>('/api/settings');
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [crt, setCrt] = useState(true);
  const [sound, setSound] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setName(data.user.name);
    setWorkspaceName(data.workspace.name);
    setCrt(data.workspace.crtOverlay);
    setSound(data.workspace.soundEnabled);
  }, [data]);

  async function save() {
    setMessage(null);
    await api('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ name, workspaceName, crtOverlay: crt, soundEnabled: sound }),
    });
    await refresh();
    reload();
    setMessage('Saved.');
  }

  async function rotate() {
    const created = await api<{ ingestionKey: string }>('/api/settings/ingestion-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'scanner' }),
    });
    setFreshKey(created.ingestionKey);
    reload();
  }

  async function revoke(id: string) {
    await api(`/api/settings/ingestion-keys/${id}`, { method: 'DELETE' });
    reload();
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    await refresh();
    navigate('/login');
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader icon={Settings} title="SETTINGS" subtitle="Workspace identity, ingestion keys, plan">
        <button onClick={() => void save()} className="bg-atom-accent px-4 py-2 font-mono text-[11px] font-bold uppercase text-black">
          Save profile
        </button>
      </PageHeader>
      {loading && !data ? <StateMessage title="Loading settings" body="Reading the workspace." /> : null}
      {error ? <StateMessage title="Settings unavailable" body={error} /> : null}
      {data ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="tech-border space-y-4 bg-atom-card p-6 lg:col-span-8">
            <label className="block font-mono text-[10px] uppercase text-atom-muted">
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full border border-atom-border bg-atom-bg p-3 text-sm text-atom-accent outline-none" />
            </label>
            <label className="block font-mono text-[10px] uppercase text-atom-muted">
              Email
              <input value={data.user.email} readOnly className="mt-2 w-full border border-atom-border bg-atom-bg p-3 text-sm text-atom-muted outline-none" />
            </label>
            <label className="block font-mono text-[10px] uppercase text-atom-muted">
              Workspace
              <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} className="mt-2 w-full border border-atom-border bg-atom-bg p-3 text-sm text-atom-accent outline-none" />
            </label>
            <div className="font-mono text-[10px] uppercase text-atom-muted">Reporting timezone</div>
            <p className="font-mono text-sm text-white">America/Phoenix. Ledger days stay on this zone.</p>
            <label className="flex items-center justify-between border border-atom-border p-4 font-mono text-[11px] uppercase">
              CRT overlay
              <input type="checkbox" checked={crt} onChange={(event) => setCrt(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between border border-atom-border p-4 font-mono text-[11px] uppercase">
              Sound markers
              <input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} />
            </label>
            <p className="font-mono text-[10px] text-atom-muted">Sound is stored only. This build does not play audio.</p>
            {message ? <p className="font-mono text-[11px] text-atom-success">{message}</p> : null}
            <button onClick={() => void logout()} className="font-mono text-[11px] uppercase text-atom-muted">
              Log out
            </button>
          </section>
          <div className="space-y-4 lg:col-span-4">
            <section className="tech-border bg-atom-card p-6 font-mono text-[11px]">
              <h3 className="uppercase tracking-widest text-white">Build</h3>
              <p className="mt-3 text-atom-muted">Version {data.build.version}</p>
              <p className="text-atom-muted">Mode {data.build.mode}</p>
              <p className="mt-3 text-white">Plan {data.workspace.plan}</p>
              <Link to="/pricing" className="mt-3 inline-block uppercase text-atom-accent">Pricing</Link>
            </section>
            <section className="tech-border bg-atom-card p-6">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-white">Ingestion keys</h3>
              <ul className="mt-3 space-y-2">
                {data.ingestionKeys.map((key) => (
                  <li key={key.id} className="flex items-center justify-between font-mono text-[11px]">
                    <span>{key.name} · {key.prefix}…</span>
                    <button onClick={() => void revoke(key.id)} className="text-atom-error">Revoke</button>
                  </li>
                ))}
                {data.ingestionKeys.length === 0 ? <li className="font-mono text-[11px] text-atom-muted">No active keys.</li> : null}
              </ul>
              <button onClick={() => void rotate()} className="mt-4 w-full border border-atom-border py-2 font-mono text-[10px] uppercase">
                Create key
              </button>
              {freshKey ? (
                <p className="mt-3 break-all font-mono text-[11px] text-atom-warning">
                  Copy this key now. It is not shown again: {freshKey}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
