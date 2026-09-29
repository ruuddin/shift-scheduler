'use client'

import { Fragment, useEffect, useState } from 'react'
import {
  Employee,
  Shift,
  fmtDay,
  fmtTime,
  colorFor,
} from '@/lib/schedule'
import { createShiftAction, updateShiftAction, deleteShiftAction } from './actions'

type Props = {
  employees: Employee[]
  initialShifts: Shift[]
  days: string[] // ISO dates, Mon → Sun
  preview: boolean
  dndEnabled: boolean
  crudEnabled: boolean
}

type ModalState =
  | { kind: 'create'; employeeId: string; date: string }
  | { kind: 'edit'; shift: Shift }
  | null

function localISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function dayLabel(iso: string): { dow: string; md: string } {
  const parts = fmtDay(new Date(iso + 'T00:00:00Z')).split(' ')
  return { dow: parts[0].replace(',', ''), md: parts.slice(1).join(' ') }
}

export default function RosterGrid({
  employees,
  initialShifts,
  days,
  preview,
  dndEnabled,
  crudEnabled,
}: Props) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [modal, setModal] = useState<ModalState>(null)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [saving, setSaving] = useState(false)
  // Mobile day view: default to the viewer's local today when it's in this
  // week, else Monday. Starts at days[0] because the server prerender runs
  // in UTC (a day ahead/behind the viewer); corrected after mount.
  const [selectedDay, setSelectedDay] = useState(days[0])
  useEffect(() => {
    const today = localISODate(new Date())
    const correct = days.includes(today) ? today : days[0]
    // Sync with the client's local date (external system): the server
    // prerender runs in UTC, which can be a day off from the viewer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDay(correct)
  }, [days])

  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? ''

  function openCreate(employeeId: string, date: string) {
    setStart('09:00')
    setEnd('17:00')
    setModal({ kind: 'create', employeeId, date })
  }

  function openEdit(shift: Shift) {
    setStart(shift.starts_at.slice(11, 16))
    setEnd(shift.ends_at.slice(11, 16))
    setModal({ kind: 'edit', shift })
  }

  async function handleSave() {
    if (!modal || saving) return
    if (start >= end) {
      alert('End time must be after start time.')
      return
    }
    setSaving(true)
    try {
      if (modal.kind === 'create') {
        const starts_at = `${modal.date}T${start}:00Z`
        const ends_at = `${modal.date}T${end}:00Z`
        if (preview) {
          setShifts((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              employee_id: modal.employeeId,
              starts_at,
              ends_at,
              published: true,
            },
          ])
        } else {
          const row = (await createShiftAction({
            employee_id: modal.employeeId,
            starts_at,
            ends_at,
          })) as Shift
          setShifts((prev) => [...prev, row])
        }
      } else {
        const sh = modal.shift
        const date = sh.starts_at.slice(0, 10)
        const starts_at = `${date}T${start}:00Z`
        const ends_at = `${date}T${end}:00Z`
        const prevShifts = shifts
        setShifts((prev) =>
          prev.map((s) => (s.id === sh.id ? { ...s, starts_at, ends_at } : s))
        )
        if (!preview) {
          try {
            await updateShiftAction(sh.id, {
              employee_id: sh.employee_id,
              starts_at,
              ends_at,
            })
          } catch (err) {
            setShifts(prevShifts)
            throw err
          }
        }
      }
      setModal(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save the shift.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!modal || modal.kind !== 'edit' || saving) return
    if (!confirm('Delete this shift?')) return
    const id = modal.shift.id
    const prevShifts = shifts
    setShifts((prev) => prev.filter((s) => s.id !== id))
    setModal(null)
    if (!preview) {
      try {
        await deleteShiftAction(id)
      } catch (err) {
        setShifts(prevShifts)
        alert(err instanceof Error ? err.message : 'Could not delete the shift.')
      }
    }
  }

  async function handleDrop(e: React.DragEvent, employeeId: string, date: string) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    const sh = shifts.find((s) => s.id === id)
    if (!sh) return
    const starts_at = `${date}T${sh.starts_at.slice(11)}`
    const ends_at = `${date}T${sh.ends_at.slice(11)}`
    if (starts_at === sh.starts_at && sh.employee_id === employeeId) return
    const prevShifts = shifts
    setShifts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, employee_id: employeeId, starts_at, ends_at } : s))
    )
    if (!preview) {
      try {
        await updateShiftAction(id, { employee_id: employeeId, starts_at, ends_at })
      } catch (err) {
        setShifts(prevShifts)
        alert(err instanceof Error ? err.message : 'Could not move the shift.')
      }
    }
  }

  return (
    <>
      {/* Desktop: full week grid */}
      <div className="hidden overflow-x-auto rounded-xl border bg-white md:block" data-tour="grid">
        <div
          className="grid min-w-[900px]"
          style={{ gridTemplateColumns: '160px repeat(7, minmax(0, 1fr))' }}
        >
          <div className="border-b bg-zinc-50 p-3" />
          {days.map((iso) => {
            const { dow, md } = dayLabel(iso)
            return (
              <div key={iso} className="border-b border-l bg-zinc-50 p-2 text-center">
                <div className="text-xs font-semibold uppercase text-zinc-500">{dow}</div>
                <div className="text-sm font-medium">{md}</div>
              </div>
            )
          })}

          {employees.map((emp, ei) => (
            <Fragment key={emp.id}>
              <div className="border-b p-3">
                <div className="font-medium">{emp.name}</div>
                <div className="text-xs text-zinc-500">{emp.email}</div>
              </div>
              {days.map((iso) => {
                const dayShifts = shifts.filter(
                  (sh) => sh.employee_id === emp.id && sh.starts_at.slice(0, 10) === iso
                )
                return (
                  <div
                    key={emp.id + iso}
                    onClick={() => crudEnabled && openCreate(emp.id, iso)}
                    onDragOver={(e) => dndEnabled && e.preventDefault()}
                    onDrop={(e) => dndEnabled && handleDrop(e, emp.id, iso)}
                    className={`min-h-20 border-b border-l p-1.5 ${crudEnabled ? 'cursor-pointer hover:bg-zinc-50' : ''}`}
                    title={crudEnabled ? 'Click to add a shift' : undefined}
                    data-tour="cell"
                  >
                    {dayShifts.map((sh) => (
                      <div
                        key={sh.id}
                        draggable={dndEnabled}
                        onDragStart={(e) => {
                          if (!dndEnabled) return
                          e.dataTransfer.setData('text/plain', sh.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (crudEnabled) openEdit(sh)
                        }}
                        className={`mb-1 rounded border px-2 py-1 text-xs font-medium ${dndEnabled ? 'cursor-grab active:cursor-grabbing' : ''} ${colorFor(ei)}`}
                        title={
                          dndEnabled && crudEnabled
                            ? 'Drag to move • click to edit'
                            : crudEnabled
                              ? 'Click to edit'
                              : undefined
                        }
                        data-tour="shift"
                      >
                        {fmtTime(sh.starts_at)}–{fmtTime(sh.ends_at)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Mobile: day picker + employee cards */}
      <div className="md:hidden" data-tour-m="grid">
        <div className="overflow-x-auto pb-1" role="tablist" aria-label="Pick a day">
          <div className="flex gap-2">
            {days.map((iso) => {
              const { dow, md } = dayLabel(iso)
              const active = iso === selectedDay
              return (
                <button
                  key={iso}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedDay(iso)}
                  className={`flex min-w-16 shrink-0 flex-col items-center rounded-xl border px-3 py-2 ${
                    active
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white'
                  }`}
                >
                  <span className={`text-[11px] font-semibold uppercase ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {dow}
                  </span>
                  <span className="text-sm font-medium">{md}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {employees.map((emp, ei) => {
            const dayShifts = shifts.filter(
              (sh) => sh.employee_id === emp.id && sh.starts_at.slice(0, 10) === selectedDay
            )
            return (
              <div key={emp.id} className="rounded-xl border bg-white p-3" data-tour-m="cell">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{emp.name}</div>
                    <div className="truncate text-xs text-zinc-500">{emp.email}</div>
                  </div>
                  {crudEnabled && (
                    <button
                      onClick={() => openCreate(emp.id, selectedDay)}
                      aria-label={`Add shift for ${emp.name} on ${dayLabel(selectedDay).dow}`}
                      className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      + Add
                    </button>
                  )}
                </div>
                {dayShifts.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    No shifts{crudEnabled ? ' — tap + Add' : ''}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map((sh) => (
                      <button
                        key={sh.id}
                        onClick={() => crudEnabled && openEdit(sh)}
                        data-tour-m="shift"
                        className={`block w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium ${colorFor(ei)} ${crudEnabled ? '' : 'cursor-default'}`}
                      >
                        {fmtTime(sh.starts_at)} – {fmtTime(sh.ends_at)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {employees.length === 0 && (
            <p className="rounded-xl border bg-white p-4 text-sm text-zinc-500">
              No team members yet.
            </p>
          )}
        </div>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-bold">
              {modal.kind === 'create' ? 'Add shift' : 'Edit shift'}
            </h2>
            <p className="mb-4 text-sm text-zinc-500">
              {modal.kind === 'create'
                ? `${empName(modal.employeeId)} • ${fmtDay(new Date(modal.date + 'T00:00:00Z'))}`
                : `${empName(modal.shift.employee_id)} • ${fmtDay(new Date(modal.shift.starts_at))}`}
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-600">Start</span>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-zinc-600">End</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                {modal.kind === 'edit' && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setModal(null)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
