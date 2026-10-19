import type { SupportBookSection } from '@domain/support-book';
import {
  FACILITY_COLORS,
  MAX_HISTORY,
  type AppState,
  type Certificate,
  type Child,
  type DayLog,
  type Facility,
  type PlanEntry,
} from './model';

export type Action =
  | { type: 'addChild'; child: Child }
  | { type: 'updateChild'; child: Child }
  | { type: 'removeChild'; childId: string }
  | { type: 'addFacility'; id: string; name: string }
  | { type: 'renameFacility'; id: string; name: string }
  | { type: 'setFacilityArchived'; id: string; archived: boolean }
  | { type: 'updateFacilityTimes'; id: string; times: Pick<Facility, 'weekdayReturn' | 'homePickup' | 'homeReturn'> }
  | { type: 'addCertificate'; certificate: Certificate }
  | { type: 'removeCertificate'; id: string }
  | { type: 'addPlans'; plans: PlanEntry[] }
  | { type: 'setPlanStatus'; id: string; status: PlanEntry['status'] }
  | { type: 'updatePlanTimes'; id: string; times: Pick<PlanEntry, 'pickupFrom' | 'periods' | 'pickupTime' | 'returnTime'> }
  | { type: 'removePlan'; id: string }
  | { type: 'saveSupportBook'; childId: string; section: SupportBookSection; body: string; now: string }
  | { type: 'addLog'; log: DayLog }
  | { type: 'removeLog'; id: string }
  | { type: 'markBackedUp'; at: string }
  | { type: 'replaceAll'; state: AppState };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addChild':
      return { ...state, children: [...state.children, action.child] };

    case 'updateChild':
      return { ...state, children: state.children.map((c) => (c.id === action.child.id ? action.child : c)) };

    case 'removeChild': {
      const { [action.childId]: _removed, ...supportBook } = state.supportBook;
      return {
        ...state,
        children: state.children.filter((c) => c.id !== action.childId),
        certificates: state.certificates.filter((c) => c.childId !== action.childId),
        plans: state.plans.filter((p) => p.childId !== action.childId),
        logs: state.logs.filter((l) => l.childId !== action.childId),
        supportBook,
      };
    }

    case 'addFacility':
      return {
        ...state,
        facilities: [
          ...state.facilities,
          {
            id: action.id,
            name: action.name,
            color: FACILITY_COLORS[state.facilities.length % FACILITY_COLORS.length],
            archived: false,
          },
        ],
      };

    case 'renameFacility':
      return {
        ...state,
        facilities: state.facilities.map((f) => (f.id === action.id ? { ...f, name: action.name } : f)),
      };

    case 'setFacilityArchived':
      return {
        ...state,
        facilities: state.facilities.map((f) => (f.id === action.id ? { ...f, archived: action.archived } : f)),
      };

    case 'updateFacilityTimes':
      return {
        ...state,
        facilities: state.facilities.map((f) => (f.id === action.id ? { ...f, ...action.times } : f)),
      };

    case 'addCertificate':
      return { ...state, certificates: [...state.certificates, action.certificate] };

    case 'removeCertificate':
      return { ...state, certificates: state.certificates.filter((c) => c.id !== action.id) };

    case 'addPlans':
      return { ...state, plans: [...state.plans, ...action.plans] };

    case 'setPlanStatus':
      return { ...state, plans: state.plans.map((p) => (p.id === action.id ? { ...p, status: action.status } : p)) };

    case 'updatePlanTimes':
      return { ...state, plans: state.plans.map((p) => (p.id === action.id ? { ...p, ...action.times } : p)) };

    case 'removePlan':
      return { ...state, plans: state.plans.filter((p) => p.id !== action.id) };

    case 'saveSupportBook': {
      const book = state.supportBook[action.childId] ?? {};
      const current = book[action.section];
      if (current && current.body === action.body) return state;
      const history = current
        ? [{ body: current.body, updatedAt: current.updatedAt }, ...current.history].slice(0, MAX_HISTORY)
        : [];
      return {
        ...state,
        supportBook: {
          ...state.supportBook,
          [action.childId]: { ...book, [action.section]: { body: action.body, updatedAt: action.now, history } },
        },
      };
    }

    case 'addLog':
      return { ...state, logs: [...state.logs, action.log] };

    case 'removeLog':
      return { ...state, logs: state.logs.filter((l) => l.id !== action.id) };

    case 'markBackedUp':
      return { ...state, lastBackupAt: action.at };

    case 'replaceAll':
      return action.state;
  }
}
