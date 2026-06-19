import { useFitEngineStore } from '../../stores/fitEngineStore';
import { useAuthStore } from '../../stores/authStore';

export function useFormulaSelector() {
  const formulas        = useFitEngineStore(s => s.formulas);
  const sessionId       = useFitEngineStore(s => s.sessionFormulaId);
  const setFormula      = useFitEngineStore(s => s.setSessionFormula);
  const activeFormulaId = useAuthStore(s => (s as { styleProfile?: { activeFormulaId?: string } }).styleProfile?.activeFormulaId ?? null);

  const activeId = sessionId ?? activeFormulaId ?? null;

  return { formulas, activeId, setFormula };
}
