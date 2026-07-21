import { memo } from "react";

export const EmptyAnalytics = ({ title, description }) => (
  <div className="analytics-empty"><span aria-hidden="true">◇</span><strong>{title}</strong><p>{description}</p></div>
);

export const BarChart = memo(function BarChart({ data = [], labelKey = "label", valueKey = "value", suffix = "", title }) {
  if (!data.some((item) => Number(item[valueKey]) > 0)) return <EmptyAnalytics title={`No ${title.toLowerCase()} data`} description="Complete more relevant activity to populate this chart." />;
  const max = Math.max(...data.map((item) => Number(item[valueKey]) || 0), 1);
  return <div className="analytics-bars" role="img" aria-label={`${title}. ${data.map((item) => `${item[labelKey]} ${item[valueKey]}${suffix}`).join(", ")}`}>
    {data.map((item) => <div className="analytics-bar-row" key={item[labelKey]} title={`${item[labelKey]}: ${item[valueKey]}${suffix}`}>
      <span>{item[labelKey]}</span><div><i style={{ width: `${Math.max(Number(item[valueKey]) / max * 100, 2)}%` }} /></div><strong>{item[valueKey]}{suffix}</strong>
    </div>)}
  </div>;
});

export const TrendChart = memo(function TrendChart({ data = [] }) {
  const valid = data.filter((item) => item.overallScore != null);
  if (!valid.length) return <EmptyAnalytics title="No score trend yet" description="Evaluated interviews will appear here over time." />;
  const width = 720; const height = 240; const padding = 30;
  const points = valid.map((item, index) => ({ x: valid.length === 1 ? width / 2 : padding + index * ((width - padding * 2) / (valid.length - 1)), y: height - padding - item.overallScore / 100 * (height - padding * 2), ...item }));
  return <div className="trend-chart-wrap">
    <svg className="analytics-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="trend-chart-title trend-chart-desc">
      <title id="trend-chart-title">Overall interview score trend</title><desc id="trend-chart-desc">{valid.map((item) => `${item.period}: ${item.overallScore}%`).join(". ")}</desc>
      {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line x1={padding} x2={width - padding} y1={height - padding - tick / 100 * (height - padding * 2)} y2={height - padding - tick / 100 * (height - padding * 2)} /><text x="2" y={height - padding - tick / 100 * (height - padding * 2) + 4}>{tick}</text></g>)}
      {points.length > 1 && <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />}
      {points.map((point) => <circle key={`${point.period}-${point.x}`} cx={point.x} cy={point.y} r="5"><title>{point.period}: {point.overallScore}% ({point.sampleSize} samples)</title></circle>)}
    </svg>
    <div className="chart-periods" aria-hidden="true"><span>{valid[0].period}</span><span>{valid.at(-1).period}</span></div>
  </div>;
});

export function RadarChart({ data = [] }) {
  if (data.length < 3) return <EmptyAnalytics title="Skill radar needs more evidence" description="At least three supported skill dimensions are required." />;
  const size = 280; const center = size / 2; const radius = 102;
  const point = (index, value = 100) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / data.length; const scaled = radius * value / 100; return `${center + Math.cos(angle) * scaled},${center + Math.sin(angle) * scaled}`; };
  return <div className="radar-layout"><svg viewBox={`0 0 ${size} ${size}`} className="radar-chart" role="img" aria-label={data.map((item) => `${item.skill} ${item.score}%`).join(", ")}>
    {[25, 50, 75, 100].map((level) => <polygon key={level} points={data.map((_, index) => point(index, level)).join(" ")} className="radar-grid" />)}
    {data.map((item, index) => <line key={item.skill} x1={center} y1={center} x2={point(index).split(",")[0]} y2={point(index).split(",")[1]} className="radar-grid" />)}
    <polygon points={data.map((item, index) => point(index, item.score)).join(" ")} className="radar-data" />
  </svg><ul>{data.map((item) => <li key={item.skill}><span>{item.skill}</span><strong>{item.score}%</strong></li>)}</ul></div>;
}

export function ScoreDistribution({ data = [] }) {
  return <BarChart data={data} labelKey="label" valueKey="count" title="Score distribution" />;
}
