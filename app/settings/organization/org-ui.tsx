'use client'

import { useState } from 'react'
import {
  createRoleAction,
  updateRoleAction,
  setMemberRoleAction,
  setMemberManagerAction,
  toggleOrgFlagAction,
  type OrgFlagRow,
} from '@/app/org-actions'
import type { OrgDetails, OrgMember, OrgRole } from '@/lib/orgs'

function Section({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{blurb}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

// ---------- roles ----------

function RolesManager({
  roles,
  onChanged,
}: {
  roles: OrgRole[]
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [rank, setRank] = useState('20')
  const [isManager, setIsManager] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createRoleAction({ name, rank: Number(rank), isManager })
      setName('')
      setRank('20')
      setIsManager(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create role.')
    } finally {
      setBusy(false)
    }
  }

  async function onToggleManager(role: OrgRole) {
    setError('')
    try {
      await updateRoleAction(role.id, { isManager: !role.is_manager })
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update role.')
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {roles.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {r.name}{' '}
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  rank {r.rank}
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                {r.is_manager
                  ? 'Can manage — full manager permissions'
                  : 'No manager permissions'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleManager(r)}
              className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              {r.is_manager ? 'Remove manager rights' : 'Grant manager rights'}
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={onCreate}
        className="mt-4 rounded-xl border bg-white p-4"
      >
        <p className="mb-3 font-medium">Define a new role</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shift Lead"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">
              Rank (higher = more senior)
            </span>
            <input
              type="number"
              min={1}
              max={1000}
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={isManager}
              onChange={(e) => setIsManager(e.target.checked)}
              className="h-4 w-4"
            />
            Manager permissions
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create role'}
        </button>
      </form>
      <p className="mt-2 text-xs text-zinc-400">
        Hierarchy rule: a manager&apos;s rank must be strictly higher than
        their reports&apos; — same rank can&apos;t manage same rank, and lower
        can&apos;t manage higher. Enforced by the database.
      </p>
    </div>
  )
}

// ---------- members ----------

function MembersManager({
  members,
  roles,
  onChanged,
}: {
  members: OrgMember[]
  roles: OrgRole[]
  onChanged: () => void
}) {
  const [error, setError] = useState('')

  // Only members whose rank is higher can be someone's manager — the
  // database enforces it, but we narrow the dropdown for clarity.
  function eligibleManagers(forMember: OrgMember): OrgMember[] {
    return members.filter(
      (m) => m.id !== forMember.id && m.role.rank > forMember.role.rank
    )
  }

  async function onRoleChange(memberId: string, roleId: string) {
    setError('')
    try {
      await setMemberRoleAction(memberId, roleId)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update role.')
    }
  }

  async function onManagerChange(memberId: string, managerId: string) {
    setError('')
    try {
      await setMemberManagerAction(memberId, managerId || null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update manager.')
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-zinc-400">
              <th className="px-4 py-2">Member</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Manager</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <p className="font-medium">{m.email ?? 'Unknown'}</p>
                  <p className="text-xs text-zinc-400">rank {m.role.rank}</p>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={m.role_id}
                    onChange={(e) => onRoleChange(m.id, e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm"
                    aria-label={`Role for ${m.email}`}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.rank})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={m.manager_membership_id ?? ''}
                    onChange={(e) => onManagerChange(m.id, e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm"
                    aria-label={`Manager for ${m.email}`}
                  >
                    <option value="">— No manager —</option>
                    {eligibleManagers(m).map((cand) => (
                      <option key={cand.id} value={cand.id}>
                        {cand.email ?? cand.id} ({cand.role.name})
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        Each member has at most one manager. The manager dropdown only lists
        members with a higher rank — the database rejects anything else.
      </p>
    </div>
  )
}

// ---------- org flags ----------

function OrgFlags({ flags, onChanged }: { flags: OrgFlagRow[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function onToggle(flagKey: string, enabled: boolean) {
    setBusy(flagKey)
    setError('')
    try {
      await toggleOrgFlagAction(flagKey, enabled)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  function stateOf(f: OrgFlagRow): 'on' | 'off' | 'unset' {
    if (f.org_enabled === true) return 'on'
    if (f.org_enabled === false) return 'off'
    return 'unset'
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {flags.map((f) => {
          const s = stateOf(f)
          return (
            <div
              key={f.flag_key}
              className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{f.flag_key}</p>
                <p className="text-xs text-zinc-500">{f.description}</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {s === 'unset'
                    ? 'Not set — teams follow the global default'
                    : s === 'on'
                      ? 'Enabled for the whole org (teams may still opt out)'
                      : 'Disabled for the whole org — teams cannot enable it'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {(['on', 'off', 'unset'] as const).map((opt) => {
                  const active = s === opt
                  const target = opt === 'on'
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={busy === f.flag_key}
                      onClick={() =>
                        opt === 'unset'
                          ? onToggle(f.flag_key, f.default_enabled)
                          : onToggle(f.flag_key, target)
                      }
                      title={
                        opt === 'unset'
                          ? 'Clear org setting (use global default)'
                          : `Set org ${opt}`
                      }
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                        active
                          ? opt === 'on'
                            ? 'bg-green-600 text-white'
                            : opt === 'off'
                              ? 'bg-zinc-800 text-white'
                              : 'bg-zinc-200 text-zinc-800'
                          : 'border text-zinc-500 hover:bg-zinc-50'
                      } disabled:opacity-50`}
                    >
                      {opt === 'unset' ? 'Default' : opt === 'on' ? 'On' : 'Off'}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        The org is a ceiling: &quot;Off&quot; here disables the feature for
        every team, and no team can turn it back on. &quot;Default&quot; clears
        the org&apos;s choice.
      </p>
    </div>
  )
}

export default function OrgSettings({
  initial,
  flags,
}: {
  initial: OrgDetails
  flags: OrgFlagRow[]
}) {
  const [details] = useState(initial)
  const [orgFlags] = useState(flags)

  // Refresh is intentionally simple: mutations reload the page to pick up
  // fresh state.
  const refresh = () => window.location.reload()

  return (
    <div>
      <Section
        title="Roles"
        blurb="Define your organization's own roles. Rank decides who can manage whom; manager rights decide who gets manager permissions."
      >
        <RolesManager roles={details.roles} onChanged={refresh} />
      </Section>

      <Section
        title="Members"
        blurb="Everyone in the organization, their role, and who they report to."
      >
        <MembersManager
          members={details.members}
          roles={details.roles}
          onChanged={refresh}
        />
      </Section>

      <Section
        title="Organization feature flags"
        blurb="Set the ceiling for every team in the organization."
      >
        <OrgFlags flags={orgFlags} onChanged={refresh} />
      </Section>
    </div>
  )
}
