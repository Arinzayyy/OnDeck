'use client';

import { useState } from 'react';
import { AddStudentModal } from './AddStudentModal';

export interface StudentRow {
  id: string;
  name: string;
  student_id: string;
  program: string | null;
  cohort: string | null;
  shift_counts: {
    total: number;
    pending: number;
    approved: number;
    cancelled: number;
    called_out: number;
  };
}

export function StudentsTable({ initial }: { initial: StudentRow[] }) {
  const [students, setStudents] = useState<StudentRow[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);

  function handleAdded(student: StudentRow) {
    // Prepend new student so they appear at the top immediately
    setStudents((prev) => [student, ...prev]);
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{students.length} enrolled</span>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add student
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              {['Name', 'ID', 'Program', 'Cohort', 'Approved', 'Pending', 'Called Out'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
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
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No students yet. Click &ldquo;Add student&rdquo; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddStudentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={handleAdded}
      />
    </>
  );
}
