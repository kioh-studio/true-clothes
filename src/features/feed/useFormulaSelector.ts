import { useFitEngineStore } from '../../stores/fitEngineStore';

export function useFormulaSelector() {
  const formulas           = useFitEngineStore(s => s.formulas);
  const sessionId          = useFitEngineStore(s => s.sessionFormulaId);
  const setFormula         = useFitEngineStore(s => s.setSessionFormula);
  // Persisted preference (style_profiles.formula_preferences) — the first
  // entry is the user's preferred default formula, used until a session
  // override is picked for this feed load.
  const formulaPreferences = useFitEngineStore(s => s.formulaPreferences);

  const activeId = sessionId ?? formulaPreferences[0] ?? null;

  return { formulas, activeId, setFormula };
}
