export type PersonKind = 'student' | 'staff';

export function kindLabel(kind: PersonKind | string): string {
  return kind === 'staff' ? 'Staff' : 'Student';
}

export function kindShort(kind: PersonKind | string): string {
  return kind === 'staff' ? 'STAFF' : 'STUDENT';
}

export const COLLECTIVE_LABEL = 'Staff / Students';
export const COLLECTIVE_LABEL_SHORT = 'Staff & Students';
