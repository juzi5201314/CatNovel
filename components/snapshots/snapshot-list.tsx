import { SectionLabel } from '../ui/section-label';

const snapshots = [
  {
    title: 'Pre-import safeguard',
    meta: 'Before TXT / EPUB ingest',
  },
  {
    title: 'Chapter rollback checkpoint',
    meta: 'Before destructive rewrite',
  },
  {
    title: 'Release rehearsal',
    meta: 'Before backup / restore drill',
  },
];

export function SnapshotList() {
  return (
    <div className="snapshot-list">
      {snapshots.map((snapshot) => (
        <article key={snapshot.title} className="snapshot-card">
          <SectionLabel>{snapshot.meta}</SectionLabel>
          <strong>{snapshot.title}</strong>
          <p>后续将接入 create / list / restore / delete 与审计记录。</p>
        </article>
      ))}
    </div>
  );
}
