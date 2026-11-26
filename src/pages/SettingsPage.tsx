import { UNIT_LABEL, type Unit } from '../lib/unit.ts';

export function SettingsPage({ unit, onChange }: { unit: Unit; onChange: (unit: Unit) => void }) {
  return (
    <>
      <h2>設定</h2>
      <fieldset data-testid="unit-setting">
        <legend>金額の表示単位</legend>
        {(Object.keys(UNIT_LABEL) as Unit[]).map((value) => (
          <label key={value}>
            <input type="radio" name="unit" value={value} checked={unit === value} onChange={() => onChange(value)} />
            {UNIT_LABEL[value]}
          </label>
        ))}
      </fieldset>
      <p className="hint">選ぶとすぐに、すべての画面の金額に反映されます。</p>
    </>
  );
}
