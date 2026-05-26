'use client';

import { useState } from 'react';
import { AddStudentModal } from './AddStudentModal';
import { EditStudentModal } from './EditStudentModal';
import { kindShort, COLLECTIVE_LABEL } from '@/lib/people';

export interface StudentRow {
  id: string;
  name: string;
  student_id: string;
  program: string | null;
  cohort: string | null;
  auth_id: string | null;
  email: string | null;
  roles: string[];
  kind: string;
  shift_counts: {
    total: number;
    pending: number;
    approved: number;
    cancelled: number;
    called_out: number;
  };
}

type Filter = 'all' | 'student' | 'staff';

export function StudentsTable({ initial }: { initial: StudentRow[] }) {
  const [students, setStudents] = useState<StudentRow[]>(initial);
  const [filter, setFilter] = useState<Filter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);

  const visible = filter === 'all' ? students : students.filter((s) => s.kind === filter);

  function handleAdded(student: StudentRow) {
    setStudents((prev) => [student, ...prev]);
  }

  function handleUpdated(updated: StudentRow) {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{COLLECTIVE_LABEL}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{students.length} enrolled</span>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add student
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {(['all', 'student', 'staff'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'student' ? 'Students' : 'Staff'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              {['Name', 'ID', 'Program', 'Cohort', 'Approved', 'Pending', 'Called Out', ''].map(
                (h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.name}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide ${
                      s.kind === 'staff'
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {kindShort(s.kind)}
                    </span>
                    {!s.auth_id && (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-yellow-100 text-yellow-700 border border-yellow-200">
                        Inactive
                      </span>
                    )}
                    {s.roles.includes('front_desk') && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700">
                        Front desk
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-gray-500">{s.student_id}</td>
                <td className="px-4 py-3 text-gray-600">{s.program ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.cohort ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="badge-approved">{s.shift_counts.approved}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="badge-pending">{s.shift_counts.pending}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="badge-called-out">{s.shift_counts.called_out}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditStudent(s)}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  {students.length === 0
                    ? 'No one on the roster yet. Click “Add student” to get started.'
                    : `No ${filter === 'staff' ? 'staff' : 'students'} match the current filter.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />
      <EditStudentModal
        open={editStudent !== null}
        student={editStudent}
        onClose={() => setEditStudent(null)}
        onUpdated={handleUpdated}
      />
    </>
  );
}
