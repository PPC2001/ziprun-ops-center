interface Props {
  score: number; // 0.0 – 1.0
}

export function ConfidenceBar({ score }: Props) {
  const pct = Math.round(score * 100);
  const cls = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';

  return (
    <div className="confidence-bar-wrapper">
      <div className="confidence-bar-header">
        <span className="confidence-bar-label">AI Confidence</span>
        <span className={`confidence-bar-value ${cls}`}>{pct}%</span>
      </div>
      <div className="confidence-bar-track">
        <div
          className={`confidence-bar-fill ${cls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
