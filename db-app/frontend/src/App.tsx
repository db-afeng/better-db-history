import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TableHistoryView } from '@shared/index';
import { DataPage } from './pages/DataPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<TableHistoryView tableName="zacdav.macq.bronze_trade_ss" />}
        />
        <Route path="/data" element={<DataPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
