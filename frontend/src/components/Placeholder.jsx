import { PageHeader, Card, Empty } from './ui';

export default function Placeholder({ label, title, description, message }) {
  return (
    <div>
      <PageHeader label={label} title={title} description={description} />
      <Card title={title}>
        <Empty title="Coming soon">{message || 'This module is part of the roadmap and will be available in a future update.'}</Empty>
      </Card>
    </div>
  );
}
