import { lazy, Suspense, useEffect, useState } from 'react';
import { Icon } from './components/Icon.tsx';
import { CustomerPage } from './pages/CustomerPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { loadUnit, saveUnit, type Unit } from './lib/unit.ts';

// ヘルプは、開いたときに初めて読み込む。
const HelpDialog = lazy(() => import('./components/HelpDialog.tsx'));

type Route = { page: 'dashboard' } | { page: 'settings' } | { page: 'customer'; name: string };

function parseRoute(hash: string): Route {
  if (hash === '#/settings') return { page: 'settings' };
  if (hash.startsWith('#/customers/')) return { page: 'customer', name: decodeURIComponent(hash.slice('#/customers/'.length)) };
  return { page: 'dashboard' };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [unit, setUnit] = useState<Unit>(loadUnit);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);

  const changeUnit = (next: Unit) => {
    setUnit(next);
    saveUnit(next);
  };

  return (
    <main>
      <header>
        <h1>売上ダッシュボード</h1>
        <nav aria-label="メニュー">
          <a href="#/">ダッシュボード</a>
          <a href="#/settings">設定</a>
          <button type="button" onClick={() => setHelpOpen(true)}>
            <Icon name="CircleHelp" /> ヘルプ
          </button>
        </nav>
      </header>

      {route.page === 'dashboard' && <DashboardPage unit={unit} />}
      {route.page === 'customer' && <CustomerPage name={route.name} unit={unit} />}
      {route.page === 'settings' && <SettingsPage unit={unit} onChange={changeUnit} />}

      {helpOpen && (
        <Suspense fallback={null}>
          <HelpDialog onClose={() => setHelpOpen(false)} />
        </Suspense>
      )}
    </main>
  );
}
