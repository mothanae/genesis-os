'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';

type Tab = 'profile' | 'workspace' | 'tokens';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const user = useAuthStore((s) => s.user);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(
          [
            ['profile', 'Profile'],
            ['workspace', 'Workspace'],
            ['tokens', 'API Tokens'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'profile' && <ProfileTab key="profile" user={user} />}
        {tab === 'workspace' && <WorkspaceTab key="workspace" />}
        {tab === 'tokens' && <TokensTab key="tokens" />}
      </AnimatePresence>
    </div>
  );
}

function ProfileTab({ user }: { user: { displayName?: string; email?: string } | null }) {
  const [name, setName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await apiClient('/api/v1/auth/me', {
        method: 'PATCH',
        body: { displayName: name },
      });
      setMessage('Profile updated successfully.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onSubmit={handleSave}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={user?.email ?? ''}
          disabled
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm bg-gray-50 text-gray-500"
        />
        <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </motion.form>
  );
}

function WorkspaceTab() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-4"
    >
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold">Default Environment</h2>
        <p className="text-xs text-gray-500 mt-1">
          New projects will use this environment as the default deployment target.
        </p>
        <select className="mt-2 border rounded px-3 py-1.5 text-sm">
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </select>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold">Default Cloud Provider</h2>
        <p className="text-xs text-gray-500 mt-1">
          Infrastructure-as-code will target this provider by default.
        </p>
        <select className="mt-2 border rounded px-3 py-1.5 text-sm">
          <option value="aws">AWS</option>
          <option value="gcp">Google Cloud</option>
          <option value="azure">Azure</option>
        </select>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold">Default Region</h2>
        <p className="text-xs text-gray-500 mt-1">
          Deployment artifacts will target this region.
        </p>
        <select className="mt-2 border rounded px-3 py-1.5 text-sm">
          <option value="us-east-1">us-east-1 (N. Virginia)</option>
          <option value="us-west-2">us-west-2 (Oregon)</option>
          <option value="eu-west-1">eu-west-1 (Ireland)</option>
          <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
        </select>
      </div>

      <button className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Save Workspace Settings
      </button>
    </motion.div>
  );
}

function TokensTab() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-4"
    >
      <div className="border border-dashed rounded-lg p-6 text-center">
        <div className="text-3xl mb-2">🔑</div>
        <h2 className="text-sm font-semibold">No API Tokens</h2>
        <p className="text-xs text-gray-500 mt-1">
          API tokens allow external services to authenticate with Genesis OS. Create one to enable CI/CD
          integration, webhook endpoints, or programmatic access.
        </p>
        <button className="mt-3 rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Generate Token
        </button>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold">Token Scopes</h2>
        <p className="text-xs text-gray-500 mt-1">
          Available scopes for generated tokens. Select specific permissions when creating a token.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {['read:projects', 'write:projects', 'read:graph', 'write:graph', 'read:agents', 'execute:agents', 'read:simulations', 'run:simulations'].map(
            (scope) => (
              <span key={scope} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-mono">
                {scope}
              </span>
            ),
          )}
        </div>
      </div>
    </motion.div>
  );
}
