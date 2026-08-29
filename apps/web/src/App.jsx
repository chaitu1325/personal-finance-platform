import { useEffect, useState } from 'react';

const modules = [
  ['Core finance', 'Income, expenses, accounts, categories, and transfers'],
  ['Family', 'People, relationships, and shared ownership'],
  ['Rental management', 'Properties, tenants, agreements, and rent payments'],
  ['Investments', 'Holdings, activity, dividends, and performance'],
  ['Assets & liabilities', 'Net worth, loans, EMI schedules, and valuations'],
];

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export default function App() {
  const [apiStatus, setApiStatus] = useState('Checking API…');

  useEffect(() => {
    fetch(\`\${apiBaseUrl}/api/v1/health\`)
      .then((response) => response.json())
      .then((payload) => setApiStatus(payload?.data?.status === 'up' ? 'API online' : 'API unavailable'))
      .catch(() => setApiStatus('API unavailable'));
  }, []);

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">PERSONAL FINANCE PLATFORM</p>
        <h1>One clear view of your family finances.</h1>
        <p className="hero-copy">
          A shared web and mobile foundation for income, expenses, rentals,
          investments, assets, and liabilities.
        </p>
        <span className={\`status-pill \${apiStatus === 'API online' ? 'online' : ''}\`}>
          {apiStatus}
        </span>
      </section>

      <section className="module-grid" aria-label="Planned modules">
        {modules.map(([title, description]) => (
          <article className="module-card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <span>Planned phase</span>
          </article>
        ))}
      </section>

      <footer>Phase 1 foundation • PHP API • MySQL • React web • Expo mobile</footer>
    </main>
  );
}
