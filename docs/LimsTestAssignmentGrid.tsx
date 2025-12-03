import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Beaker, 
  Microscope, 
  Activity, 
  CheckCircle2, 
  X, 
  Plus, 
  Save, 
  FlaskConical,
  TestTube2,
  Settings2,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square
} from 'lucide-react';

// --- Types ---

type TestCategory = 'Microbiology' | 'Chemistry' | 'Hematology' | 'Molecular';

interface TestMethod {
  id: string;
  code: string;
  name: string;
  category: TestCategory;
  tat: string; 
  price: number;
  tags: string[];
}

interface Sample {
  id: string;
  client: string;
  matrix: string;
  collectedAt: string;
  priority: 'Routine' | 'Urgent' | 'Stat';
}

// --- Mock Data ---

const SAMPLE_DATA: Sample = {
  id: 'SPL-2025-8842',
  client: 'Apex Pharmaceuticals',
  matrix: 'Wastewater',
  collectedAt: '2023-10-24 08:30 AM',
  priority: 'Urgent',
};

const TEST_CATALOG: TestMethod[] = [
  { id: '1', code: 'MIC-001', name: 'Total Coliforms', category: 'Microbiology', tat: '24h', price: 25, tags: ['ISO 9308'] },
  { id: '2', code: 'MIC-002', name: 'E. coli Confirmation', category: 'Microbiology', tat: '48h', price: 30, tags: ['ISO 9308'] },
  { id: '3', code: 'CHE-105', name: 'pH Level', category: 'Chemistry', tat: '1h', price: 10, tags: ['EPA 150.1'] },
  { id: '4', code: 'CHE-202', name: 'Heavy Metals Panel (Pb, Hg, As)', category: 'Chemistry', tat: '72h', price: 150, tags: ['ICP-MS'] },
  { id: '5', code: 'CHE-300', name: 'Dissolved Oxygen', category: 'Chemistry', tat: '4h', price: 15, tags: ['Field'] },
  { id: '6', code: 'MOL-500', name: 'SARS-CoV-2 PCR', category: 'Molecular', tat: '24h', price: 90, tags: ['PCR'] },
  { id: '7', code: 'MIC-003', name: 'Salmonella spp.', category: 'Microbiology', tat: '72h', price: 45, tags: ['ISO 6579'] },
  { id: '8', code: 'HEM-001', name: 'Complete Blood Count', category: 'Hematology', tat: '4h', price: 20, tags: ['Auto'] },
  { id: '9', code: 'CHE-404', name: 'Nitrates/Nitrites', category: 'Chemistry', tat: '24h', price: 35, tags: ['IC'] },
  { id: '10', code: 'MIC-004', name: 'Legionella pneumophila', category: 'Microbiology', tat: '10d', price: 85, tags: ['Culture'] },
  { id: '11', code: 'CHE-501', name: 'Total Organic Carbon', category: 'Chemistry', tat: '48h', price: 55, tags: ['5310 B'] },
  { id: '12', code: 'MIC-005', name: 'Yeast & Mold', category: 'Microbiology', tat: '5d', price: 40, tags: ['BAM'] },
];

// --- Components ---

const Badge = ({ children, color = 'gray' }: { children: React.ReactNode, color?: 'gray' | 'red' | 'blue' | 'green' | 'amber' }) => {
  const colors = {
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- Main Application ---

export default function App() {
  // State
  const [selectedTests, setSelectedTests] = useState<TestMethod[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TestCategory | 'All'>('All');
  const [sortConfig, setSortConfig] = useState<{ key: keyof TestMethod, direction: 'asc' | 'desc' } | null>({ key: 'code', direction: 'asc' });
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Sorting Handler
  const requestSort = (key: keyof TestMethod) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Derived State
  const processedTests = useMemo(() => {
    let data = TEST_CATALOG.filter(test => {
      const matchesSearch = test.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            test.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || test.category === activeCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortConfig) {
      data.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [searchQuery, activeCategory, sortConfig]);

  const totalCost = selectedTests.reduce((sum, test) => sum + test.price, 0);

  // Handlers
  const toggleTestSelection = (test: TestMethod) => {
    if (selectedTests.find(t => t.id === test.id)) {
      setSelectedTests(prev => prev.filter(t => t.id !== test.id));
    } else {
      setSelectedTests(prev => [...prev, test]);
    }
  };

  const handleSave = () => {
    if (selectedTests.length === 0) return;
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 1200);
  };

  const getCategoryIcon = (cat: TestCategory) => {
    switch(cat) {
      case 'Microbiology': return Microscope;
      case 'Chemistry': return FlaskConical;
      case 'Hematology': return Activity;
      case 'Molecular': return TestTube2;
      default: return Beaker;
    }
  };

  const SortIcon = ({ column }: { column: keyof TestMethod }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-50" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-blue-600" />
      : <ArrowDown size={14} className="text-blue-600" />;
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      
      {/* -------------------------------------------------------------
          LEFT PANE: SAMPLE CONTEXT (Identical to previous)
      ----------------------------------------------------------------- */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col z-20 shrink-0">
        <div className="p-4 border-b border-slate-200 bg-slate-100">
          <div className="flex items-center gap-2 text-blue-700 mb-1">
            <FlaskConical size={18} />
            <span className="font-bold tracking-tight text-sm">LIMS<span className="text-slate-900">Pro</span> Grid</span>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <div className="mb-6">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sample ID</label>
            <div className="text-lg font-mono font-bold text-slate-800 mt-1 flex items-center gap-2 tracking-tight">
              {SAMPLE_DATA.id}
            </div>
            <div className="mt-2 flex gap-2">
               <Badge color="red">{SAMPLE_DATA.priority}</Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Client</label>
              <div className="text-sm font-medium text-slate-700">
                {SAMPLE_DATA.client}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Matrix</label>
              <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                {SAMPLE_DATA.matrix}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-slate-100 text-[10px] text-slate-500 text-center">
          Workflow ID: 8821-A
        </div>
      </aside>


      {/* -------------------------------------------------------------
          CENTER PANE: DATA GRID
      ----------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-4 justify-between bg-white">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search methods..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <select 
              className="bg-slate-50 border border-slate-200 text-sm rounded px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as any)}
            >
              <option value="All">All Categories</option>
              <option value="Microbiology">Microbiology</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Molecular">Molecular</option>
            </select>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {processedTests.length} methods found
          </div>
        </div>

        {/* The Grid Header */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm ring-1 ring-slate-900/5">
                <tr>
                  <th className="p-3 w-12 border-b border-slate-200 bg-slate-50">
                     {/* Select All Checkbox could go here */}
                  </th>
                  <th onClick={() => requestSort('code')} className="group p-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 border-b border-slate-200 w-32 select-none">
                    <div className="flex items-center gap-1">Code <SortIcon column="code" /></div>
                  </th>
                  <th onClick={() => requestSort('name')} className="group p-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 border-b border-slate-200 select-none">
                    <div className="flex items-center gap-1">Method Name <SortIcon column="name" /></div>
                  </th>
                  <th onClick={() => requestSort('category')} className="group p-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 border-b border-slate-200 w-40 select-none">
                     <div className="flex items-center gap-1">Category <SortIcon column="category" /></div>
                  </th>
                  <th onClick={() => requestSort('tat')} className="group p-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 border-b border-slate-200 w-24 select-none">
                     <div className="flex items-center gap-1">TAT <SortIcon column="tat" /></div>
                  </th>
                  <th onClick={() => requestSort('price')} className="group p-3 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 border-b border-slate-200 w-28 text-right select-none">
                     <div className="flex items-center gap-1 justify-end">Price <SortIcon column="price" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {processedTests.map((test, index) => {
                  const isSelected = selectedTests.some(t => t.id === test.id);
                  const Icon = getCategoryIcon(test.category);
                  
                  return (
                    <tr 
                      key={test.id}
                      onClick={() => toggleTestSelection(test)}
                      className={`
                        cursor-pointer transition-colors border-b border-slate-100 last:border-0 hover:bg-slate-50
                        ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}
                      `}
                    >
                      <td className="p-3 text-center">
                        {isSelected ? (
                          <CheckSquare size={18} className="text-blue-600 inline-block" />
                        ) : (
                          <Square size={18} className="text-slate-300 inline-block" />
                        )}
                      </td>
                      <td className={`p-3 text-sm font-mono ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-600'}`}>
                        {test.code}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{test.name}</span>
                          {test.tags.length > 0 && (
                            <span className="text-[10px] text-slate-400 mt-0.5">{test.tags.join(', ')}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Icon size={14} className="text-slate-400" />
                          {test.category}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-slate-600">
                        {test.tat}
                      </td>
                      <td className="p-3 text-sm font-mono text-slate-700 text-right">
                        ${test.price.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>


      {/* -------------------------------------------------------------
          RIGHT PANE: STAGING AREA (Compact Version)
      ----------------------------------------------------------------- */}
      <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-xl z-30 shrink-0">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {selectedTests.length}
            </div>
            <h2 className="font-semibold text-slate-800 text-sm">Selection</h2>
          </div>
          <button 
            onClick={() => setSelectedTests([])}
            className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-600 tracking-wider"
          >
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {selectedTests.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-10 h-10 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center mb-2">
                <Plus size={16} className="text-slate-300" />
              </div>
              <p className="text-xs text-slate-500">Select rows from grid</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-100">
                {selectedTests.map((test) => (
                  <tr key={test.id} className="group hover:bg-red-50/30 transition-colors">
                    <td className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                           <span className="text-xs font-bold text-slate-600 font-mono">{test.code}</span>
                           <span className="text-sm text-slate-800 leading-tight mt-0.5">{test.name}</span>
                        </div>
                        <button 
                          onClick={() => toggleTestSelection(test)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">{test.tat}</span>
                        <span className="text-xs font-mono font-medium text-slate-600">${test.price.toFixed(2)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex justify-between items-center mb-4 text-sm">
            <span className="text-slate-500 font-medium">Total</span>
            <span className="font-bold text-slate-800 text-lg font-mono">${totalCost.toFixed(2)}</span>
          </div>

          <button 
            onClick={handleSave}
            disabled={selectedTests.length === 0 || isSaving}
            className={`
              w-full flex items-center justify-center gap-2 p-2.5 rounded shadow-sm text-sm font-semibold text-white transition-all
              ${selectedTests.length === 0 
                ? 'bg-slate-300 cursor-not-allowed' 
                : isSaving 
                  ? 'bg-blue-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }
            `}
          >
            {isSaving ? 'Processing...' : 'Assign Tests'}
          </button>
        </div>
      </aside>

      {/* Toast Notification */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded shadow-lg flex items-center gap-3 transition-all duration-300 z-50 ${showToast ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
        <CheckCircle2 size={18} className="text-green-400" />
        <span className="text-sm font-medium">Changes Saved</span>
      </div>

    </div>
  );
}